// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */
const config = require('../utils/config');

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const GameSchema = new mongoose.Schema({
    title: { type: String, required: true },             //titulo del juego
    release_date: { type: Date },
    slug: { type: String, required: true, unique: true },
    platformID: { type: [Number], required: true },    //ID de todas las plataformas en las que existen saves para este juego
    saveID: { type: [Number], default: [] },       //todos los ID de los saves subidos para este juego
    cover: { type: String, default: config.paths.gameCover_default }, //ruta de la imagen caratula  
    IGDB_ID: { type: Number, required: true },
    IGDB_url: { type: String, required: false },
    PCGW_ID: { type: String }, //es lo que se usa al final de la url
    PCGW_url: { type: String },
    external: { type: Boolean, required: true },
    userFav: { type: [Number], default: [] },    //usuarios que marcaron el juego como favorito
    saveLocations: [
        {
            platformID: { type: Number, required: true }, //id de nuestras plataformas (las de igdb)
            platformName: { type: String, required: false }, // nombre visible que viene de pcgw
            locations: { type: [String], required: true } //rutas
        }
    ]
});
GameSchema.plugin(AutoIncrement, { inc_field: 'gameID', start_seq: 0 });

function mapFiltersToIGDB(localFilters) {
    if (!localFilters) return {};
    const mapped = {};
    for (const [key, value] of Object.entries(localFilters)) {
        if (key === 'title') mapped['name'] = value; //busquedas mas seguras si slugificamos los nombres
        // else if (key === 'platformsID') mapped['platforms'] = value;
        else if (key === 'slug') mapped['slug'] = value;
        else if (key === 'IGDB_ID') mapped['id'] = value;
        else if (key === '_id') mapped['id'] = value;
        else if (key === 'release_date') mapped['first_release_date'] = value;
    }
    return mapped;
}


function normalizeStr(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
function processQuery(query) {
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

const Games = mongoose.models.Games || mongoose.model('games', GameSchema);
module.exports = { Games, mapFiltersToIGDB, processQuery }