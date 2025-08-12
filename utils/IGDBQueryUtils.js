const { getModelDefinition } = require('../models/modelRegistry.js'); // Asumiendo que este es el archivo con modelRegistry
const { getSaveFileLocations } = require('../services/pcgwServices');
const { callIGDB } = require('../services/igdbServices');
const config = require('./config.js');
const { Games } = require('../models/Games');
const { Platforms } = require('../models/Platforms');
const { getIgdbPlatformIds, getIgdbPlatformMap } = require('./constants');

const igdbOpMap = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
    ne: '!=',
    like: '~',
    start: '~',
    end: '~',
    in: '=', // IGDB no tiene $in exacto, manejamos coma
    nin: '!='
};

const slugifyFields = ['title']; // Campos que deben slugificarse

function IGDB_buildWhereViaQuery(rawQuery, modelName) {
    const modelDef = getModelDefinition(modelName);
    //aqui deberia comprobar que haya algun valor en la query que NO se encuentre dentro de modelDefinition.igdbFilterFields, y si es asi devolver un error

    if (!modelDef?.igdbFilterFields || !modelDef?.filterFields) return undefined;
    // Validar claves desconocidas
    const validFields = Object.keys(modelDef.igdbFilterFields);
    const disallowedKeys = Object.keys(rawQuery).filter(
        key => key !== 'limit' && key !== 'offset' && !validFields.includes(key)
    );
    if (disallowedKeys.length) {
        throw new Error(
            `Invalid filter key(s) provided: ${disallowedKeys.join(', ')}`
        );
    }
    // Detectar si hay que aplicar slugify
    const shouldSlugify = slugifyFields.some(field =>
        field in rawQuery && 'slug' in modelDef.igdbFilterFields
    );
    const query = shouldSlugify ? slugifyQuery(rawQuery) : rawQuery;
    const whereClauses = [];

    for (const [localKey, value] of Object.entries(query)) {
        if (localKey === 'limit' || localKey === 'offset') continue;

        const igdbField = modelDef.igdbFilterFields[localKey];
        const type = modelDef.filterFields[localKey];
        if (!igdbField || !type) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [op, rawV] of Object.entries(value)) {
                const igdbOp = igdbOpMap[op];
                if (!igdbOp) continue;

                if (['like', 'start', 'end'].includes(op)) {
                    const val = String(rawV).toLowerCase();
                    if (op === 'like') {
                        whereClauses.push(`${igdbField} ${igdbOp} *"${val}"*`);
                    } else if (op === 'start') {
                        whereClauses.push(`${igdbField} ${igdbOp} "${val}"*`);
                    } else if (op === 'end') {
                        whereClauses.push(`${igdbField} ${igdbOp} *"${val}"`);
                    }
                } else if (op === 'in') {
                    const arr = Array.isArray(rawV)
                        ? rawV
                        : String(rawV).split(/[,;]/).map(v => v.trim());
                    const formattedList = arr.map(v => formatValueForIGDB(v, type)).join(',');
                    whereClauses.push(`${igdbField} = (${formattedList})`);
                } else {
                    const formatted = formatValueForIGDB(rawV, type);
                    whereClauses.push(`${igdbField} ${igdbOp} ${formatted}`);
                }
            }
        } else {
            const formatted = formatValueForIGDB(value, type);
            whereClauses.push(`${igdbField} = ${formatted}`);
        }
    }

    return whereClauses.length ? whereClauses.join(' & ') : undefined;
}


/**
 * Formatea un valor según su tipo para usarlo en una query de IGDB.
 * - Strings se devuelven entre comillas dobles.
 * - Números y booleanos se devuelven como string sin comillas.
 * - Fechas se convierten a timestamp UNIX (segundos).
 */function formatValueForIGDB(value, type) {
    if (type.startsWith("array:")) {
        // Extraemos tipo interno (ej: "number" en "array:number")
        const innerType = type.slice("array:".length);

        if (!Array.isArray(value)) {
            // Si no es array, intentar convertir string separado por comas o puntos y coma
            if (typeof value === "string") {
                value = value.split(/[,;]/).map(v => v.trim());
            } else {
                throw new Error(`Expected array value for type ${type}, got: ${value}`);
            }
        }
        // Formateamos cada elemento con el tipo interno
        return value.map(v => formatValueForIGDB(v, innerType)).join(",");
    }

    switch (type) {
        case "number":
            if (isNaN(Number(value))) {
                throw new Error(`Invalid number value: '${value}'`);
            }
            return String(Number(value));

        case "boolean":
            if (value === "true" || value === true) return "1";
            if (value === "false" || value === false) return "0";
            throw new Error(`Invalid boolean value: '${value}'`);

        case "date":
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date value: '${value}'`);
            }
            return String(Math.floor(date.getTime() / 1000)); // UNIX timestamp en segundos

        case "string":
        default:
            const safe = String(value).replace(/["\\]/g, "");
            return `"${safe}"`;
    }
}



function slugifyString(input) {
    if (!input) return '';

    const charMap = {
        '@': 'at',
        '+': 'plus',
        '=': 'equals',
        '.': 'dot',
        '/': 'slash',
        '&': 'and',
        '°': 'degrees',
        '*': 'star'
    };

    const validCharRegex = /[a-z0-9$]/;

    let str = normalizeStr(input.toLowerCase().trim());

    str = str.split('').map(char => {
        if (charMap[char]) return ` ${charMap[char]} `;
        if (validCharRegex.test(char)) return char;
        if (char === ' ') return ' ';
        return ' '; // cualquier otro símbolo se elimina (reemplazado por espacio)
    }).join('');

    return str
        .replace(/\s+/g, '-')    // espacios (incluyendo los que vienen de caracteres eliminados) → guión
        .replace(/-+/g, '-')     // guiones repetidos → uno solo
        .replace(/^-+|-+$/g, ''); // guiones extremos eliminados
}
/**
 * Procesa la query para sustituir 'title' por 'slug', aplicando slugify al valor
 */
function slugifyQuery(query) {
    if (!query || typeof query !== 'object') return query;

    const newQuery = { ...query };

    // Eliminar 'slug' si ya existe
    delete newQuery.slug;

    // Detectar si hay campo 'title'
    if ('title' in query) {
        const val = query.title;
        if (typeof val === 'object' && val !== null && 'in' in val) {
            // dejamos title[in] tal cual, no hacemos nada ni tocamos slug
        } else if (typeof val === 'string') {
            // Cuando title = string, generamos slug[in] con sufijos separados por ';'
            const baseSlug = slugifyString(val);
            const slugArray = [baseSlug];
            for (let i = 1; i <= 7; i++) {
                slugArray.push(`${baseSlug}--${i}`);
            }
            newQuery.slug = { in: slugArray.join(';') };
            delete newQuery.title;
        } else if (typeof val === 'object' && val !== null) {
            // Procesamos operadores, solo transformamos 'end' a slug[end]
            const transformed = {};

            for (const [op, rawVal] of Object.entries(val)) {
                if (typeof rawVal !== 'string') continue;

                if (op === 'end') {
                    transformed.end = slugifyString(rawVal);
                } else if (op === 'like') {
                    transformed.like = slugifyString(rawVal);
                } else if (op === 'start') {
                    transformed.start = slugifyString(rawVal);
                }

                // Ignoramos otros operadores (incluyendo start, like, etc)
            }

            if (Object.keys(transformed).length > 0) {
                newQuery.slug = transformed;
            }
            delete newQuery.title;
        }
    }

    return newQuery;
}

function normalizeStr(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}


/**
 * Search raw games from IGDB and map them with createGameFromIGDB.
 * @param {Object} params.query - Query filters from req.query.
 * @param {number} params.limit - Pagination limit.
 * @param {number} params.offset - Pagination offset.
 * @param {boolean} params.complete - If true, fetch extra data.
 * @returns {Promise<Array<Game>>}
 */
async function searchGamesFromIGDB({ query, limit = 50, offset = 0, complete = true }) {
    const { platformID, ...restQuery } = query;
    // Mapear platformIDs si vienen
    if (platformID) {
        const map = getIgdbPlatformMap();
        let mappedIDs = [];

        if (typeof platformID === 'object' && platformID !== null) {
            // Tiene operadores como { in: '65,48' }
            for (const [op, rawValue] of Object.entries(platformID)) {
                const values = String(rawValue)
                    .split(/[,;]/)
                    .map((v) => v.trim());
                const mapped = values.map((v) => map[v]).filter(Boolean);
                if (mapped.length > 0) {
                    if (!restQuery.platformID) restQuery.platformID = {};
                    restQuery.platformID[op] = mapped.join(',');
                }
            }
        } else {
            const values = String(platformID)
                .split(/[,;]/)
                .map((v) => v.trim());
            const mapped = values.map((v) => map[v]).filter(Boolean);
            if (mapped.length > 0) {
                restQuery.platformID = mapped.join(',');
            }
        }
    }

    const whereString = IGDB_buildWhereViaQuery(restQuery, 'game');
    const baseConditions = [
        'version_parent = null',
        'game_type = (0,3,4,8,9,11)'
    ];

    if (whereString) {
        baseConditions.push(whereString);
    }

    // Si no se filtró explícitamente por plataformas, aplicar las conocidas por defecto
    if (!whereString || !whereString.includes("platforms")) {
        baseConditions.push(`platforms = (${getIgdbPlatformIds().join(',')})`);
    }

    const finalWhere = baseConditions.join(' & ');
    const igdbQuery = `
        fields name, cover.image_id, screenshots.image_id, platforms, slug, id, url, first_release_date;
        limit ${limit};
        offset ${offset};
        where ${finalWhere};
        sort rating_count desc;
    `;
    const igdbResultsRaw = await callIGDB('games', igdbQuery);
    const enrichedGames = await Promise.all(
        igdbResultsRaw.map(game => createGameFromIGDB(game, complete))
    );
    return enrichedGames.sort((a, b) => a.IGDB_ID - b.IGDB_ID);
}

const validPlatforms = [65, 45, 44, 27]; // Windows, Mac, Linux, DOS
async function createGameFromIGDB(game, complete = true, external = true, selectDuplicates = true) {
    const {
        id: gameID,
        name,
        platforms = [],
        cover,
        screenshots,
        slug,
        url: IGDB_url,
        first_release_date,
        nUploads = 0,
        lastUpdate = null,
    } = game;
    const existingGame = await Games.findOne({ gameID });
    if (existingGame) {
        if (selectDuplicates === true) {
            return existingGame
        }
        else {
            return undefined
        }
    }

    const coverURL = cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${cover.image_id}.jpg`
        : config.paths.gameCover_default;
    const screenshotURL = complete ?
        Array.isArray(screenshots) && screenshots[0]?.image_id
            ? `https://images.igdb.com/igdb/image/upload/t_1080p/${screenshots[0].image_id}.jpg`
            : config.paths.banner_default
        : undefined

    //PLATAFORMAS CON NUESTROS ID
    const platformRes = await Platforms.find({ IGDB_ID: { $in: platforms } })
    const platformsGSDB = platformRes.map(p => p.platformID);
    const newGame = {
        gameID,
        title: name,
        platformID: platformsGSDB,
        saveID: [],
        cover: coverURL,
        screenshot: screenshotURL,
        IGDB_url,
        release_date: first_release_date ? new Date(first_release_date * 1000) : undefined,
        slug,
        external,
        nUploads,
        lastUpdate,
    };

    if (complete) {
        const matchingPlatforms = platformsGSDB.filter(p => validPlatforms.includes(p));
        if (matchingPlatforms.length > 0) {
            const saveData = await getSaveFileLocations(name);
            if (saveData?.saveLocations?.length) {
                newGame.PCGW_ID = saveData.pcgwID;
                newGame.PCGW_url = saveData.pcgwURL;
                newGame.saveLocations = saveData.saveLocations
                    .filter(loc => matchingPlatforms.includes(loc.platform))
                    .map(loc => ({
                        platformID: loc.platform,
                        platformName: loc.platformName,
                        locations: loc.locations,
                    }));
            }
        }
    }
    return newGame;
}


module.exports = { searchGamesFromIGDB, createGameFromIGDB };
