const { Platforms } = require('../models/Platforms');

//funciones para interactuar con peticiones a mongodb

/**
 * Construye un filtro para MongoDB basado en la query recibida y los campos permitidos
 * 
 * @param {Object} query - Parámetros de consulta recibidos, por ejemplo req.query
 * @param {Object} modelFields - Campos permitidos para filtrar, en formato { fieldName: tipoDato }
 * @returns {Object} filter - Filtro para usar en consultas MongoDB
 */

function buildMongoFilter(query, modelFields) {
    const filter = {};
    if (!query || Object.keys(query).length === 0) return undefined

    const mongoOpMap = { gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', eq: '$eq', ne: '$ne', like: '$regex', start: '$regex', end: '$regex', in: '$in' };

    const allowedKeys = Object.keys(modelFields);
    const invalidKeys = Object.keys(query).filter(k => !allowedKeys.includes(k) && k !== '_id' && k !== 'text');

    if (invalidKeys.length > 0) {
        const error = new Error(`Invalid parameters: ${invalidKeys.join(', ')}`);
        error.name = 'InvalidQueryFields';
        throw error;
    }

    let platformIDs = []
    if (allowedKeys.includes("platformID") || allowedKeys.includes("platformsID")) {
        platformIDs = Platforms.find().distinct('IGDB_ID');
    }

    for (const [field, type] of Object.entries(modelFields)) {
        const value = query[field];
        if (value !== undefined) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                filter[field] = {};
                for (const op in value) {
                    const mongoOp = mongoOpMap[op];
                    if (mongoOp) {
                        let val = value[op];
                        try {
                            if (mongoOp === '$regex') {
                                if (type !== 'string') {
                                    throw new Error(`Operator '${op}' only supported on type 'string'`);
                                }
                                val = normalizeStr(String(val));
                                let pattern = val;
                                if (op === 'like') {
                                    pattern = `.*${escapeRegExp(val)}.*`;
                                } else if (op === 'start') {
                                    pattern = `^${escapeRegExp(val)}`;
                                } else if (op === 'end') {
                                    pattern = `${escapeRegExp(val)}$`;
                                }
                                filter[field][mongoOp] = new RegExp(pattern, 'i');
                            } else if (mongoOp === '$in') {
                                // Si viene string, lo convertimos a array por ; o ,
                                let arrValues;
                                if (typeof val === 'string') {
                                    arrValues = val.split(/[,;]/).map(v => v.trim()).filter(v => v.length > 0);
                                } else if (Array.isArray(val)) {
                                    arrValues = val;
                                } else {
                                    throw new Error(`Invalid value for 'in' operator; expected string or array`);
                                }
                                // casteamos cada valor
                                const castedValues = arrValues.map(v => castValueByType(v, type));

                                // Validación específica para platformID/platformsID
                                if ((field === 'platformID' || field === 'platformsID') && platformIDs.length > 0) {
                                    const invalid = castedValues.filter(v => !platformIDs.includes(v));
                                    if (invalid.length > 0) {
                                        throw new Error(`Invalid platformID(s): ${invalid.join(', ')}`);
                                    }
                                }

                                filter[field][mongoOp] = castedValues;
                            } else {
                                // Otros operadores normales
                                const casted = castValueByType(val, type);

                                if ((field === 'platformID' || field === 'platformsID') && platformIDs.length > 0) {
                                    if (!platformIDs.includes(casted)) {
                                        throw new Error(`Invalid platformID: ${casted}`);
                                    }
                                }

                                filter[field][mongoOp] = casted;
                            }
                        } catch (err) {
                            const error = new Error(`Field '${field}' operator '${op}': ${err.message}`);
                            error.name = 'InvalidQueryFields';
                            throw error;
                        }
                    }
                }
            } else {
                try {
                    if (type === 'string') {
                        const normalized = normalizeStr(value);
                        filter[field] = { $regex: new RegExp(`^${escapeRegExp(normalized)}$`, 'i') };
                    } else {
                        const casted = castValueByType(value, type);

                        if ((field === 'platformID' || field === 'platformsID') && platformIDs.length > 0) {
                            if (!platformIDs.includes(casted)) {
                                throw new Error(`Invalid platformID: ${casted}`);
                            }
                        }

                        filter[field] = casted;
                    }
                } catch (err) {
                    const error = new Error(`Field '${field}': ${err.message}`);
                    error.name = 'InvalidQueryFields';
                    throw error;
                }
            }
        }
    }

    return filter;
}

async function buildIGDBFilter(rawQuery, modelFields, mapFiltersFn) {
    if (!rawQuery || Object.keys(rawQuery).length === 0) rawQuery = {};

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
        in: '='
    };

    const stringOnlyOps = ['like', 'start', 'end'];
    const allowedKeys = Object.keys(modelFields);
    const invalidKeys = Object.keys(rawQuery).filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) {
        const error = new Error(`Invalid parameters: ${invalidKeys.join(', ')}`);
        error.name = 'InvalidQueryFields';
        throw error;
    }

    // Obtener lista de plataformas válidas
    const platformIDs = await Platforms.find().distinct('IGDB_ID');

    // --- Detectar si existe platformID/platformsID en el modelo y su campo IGDB ---
    let platformFieldIGDB = null;
    for (const key of ['platformID', 'platformsID']) {
        if (modelFields[key]) {
            const igdbField = mapFiltersFn({ [key]: 1 });
            platformFieldIGDB = igdbField ? Object.keys(igdbField)[0] : key;
            break;
        }
    }

    const conditions = [];

    for (const [localField, type] of Object.entries(modelFields)) {
        const value = rawQuery[localField];
        if (value === undefined) continue;

        const igdbField = mapFiltersFn({ [localField]: 1 })
            ? Object.keys(mapFiltersFn({ [localField]: 1 }))[0]
            : localField;

        const isPlatformField = localField === 'platformID' || localField === 'platformsID';

        if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [op, valRaw] of Object.entries(value)) {
                const opSymbol = igdbOpMap[op];
                if (!opSymbol) continue;

                try {
                    if (stringOnlyOps.includes(op) && type !== 'string') {
                        throw new Error(`Operator '${op}' is only supported on type 'string'`);
                    }

                    if (op === 'in') {
                        let arrValues;
                        if (typeof valRaw === 'string') {
                            arrValues = valRaw.split(/[,;]/).map(v => v.trim()).filter(v => v.length > 0);
                        } else if (Array.isArray(valRaw)) {
                            arrValues = valRaw;
                        } else {
                            throw new Error(`Invalid value for 'in' operator; expected string or array`);
                        }

                        const castedValues = arrValues.map(v => formatValueForIGDB(v, type));
                        if (isPlatformField && platformIDs.length > 0) {
                            const invalid = castedValues.filter(v => !platformIDs.includes(Number(v)));
                            if (invalid.length > 0) {
                                throw new Error(`Invalid platformID(s): ${invalid.join(', ')}`);
                            }
                        }

                        conditions.push(`${igdbField} = (${castedValues.join(', ')})`);
                    } else {
                        const valFormatted = formatValueForIGDB(valRaw, type);
                        if (isPlatformField && platformIDs.length > 0 && !platformIDs.includes(Number(valFormatted))) {
                            throw new Error(`Invalid platformID: ${valFormatted}`);
                        }

                        if (op === 'like') {
                            conditions.push(`${igdbField} ${opSymbol} *${valFormatted}*`);
                        } else if (op === 'start') {
                            conditions.push(`${igdbField} ${opSymbol} ${valFormatted}*`);
                        } else if (op === 'end') {
                            conditions.push(`${igdbField} ${opSymbol} *${valFormatted}`);
                        } else {
                            conditions.push(`${igdbField} ${opSymbol} ${valFormatted}`);
                        }
                    }
                } catch (err) {
                    const error = new Error(`Field '${localField}' operator '${op}': ${err.message}`);
                    error.name = 'InvalidQueryFields';
                    throw error;
                }
            }
        } else {
            try {
                const valFormatted = formatValueForIGDB(value, type);
                if (isPlatformField && platformIDs.length > 0 && !platformIDs.includes(Number(valFormatted))) {
                    throw new Error(`Invalid platformID: ${valFormatted}`);
                }
                conditions.push(`${igdbField} = ${valFormatted}`);
            } catch (err) {
                const error = new Error(`Field '${localField}': ${err.message}`);
                error.name = 'InvalidQueryFields';
                throw error;
            }
        }
    }

    let result = conditions.join(' & ');

    // Si se detectó platformFieldIGDB, pero no hay ningún filtro para él, añadimos todos por defecto
    if (platformFieldIGDB && !conditions.some(c => c.startsWith(`${platformFieldIGDB} `))) {
        result += (result ? ' & ' : '') + `${platformFieldIGDB} = (${platformIDs.join(',')})`;
    }

    return result;
}


/**
 * Filtra un array de objetos en memoria según la query y los campos permitidos.
 * 
 * @param {Array<Object>} dataArray - Array de objetos a filtrar
 * @param {Object} query - Parámetros de filtrado (ejemplo req.query)
 * @param {Object} modelFields - Campos permitidos con tipo (ejemplo { title: 'string', external: 'boolean' })
 * @returns {Array<Object>} - Array filtrado
 */
function filterData(dataArray, query, modelFields) {
    if (!query || Object.keys(query).length === 0) return dataArray;

    // Validar campos inválidos
    const allowedKeys = Object.keys(modelFields);
    const invalidKeys = Object.keys(query).filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) {
        const error = new Error(`Invalid parameters: ${invalidKeys.join(', ')}`);
        error.name = 'InvalidQueryFields';
        throw error;
    }

    // Funciones para evaluar operadores
    const operators = {
        gt: (a, b) => a > b,
        gte: (a, b) => a >= b,
        lt: (a, b) => a < b,
        lte: (a, b) => a <= b,
        eq: (a, b) => a === b,
        ne: (a, b) => a !== b,
        like: (a, b) => typeof a === 'string' && new RegExp(escapeRegExp(b), 'i').test(normalizeStr(a)),
        start: (a, b) => typeof a === 'string' && normalizeStr(a).startsWith(normalizeStr(b)),
        end: (a, b) => typeof a === 'string' && normalizeStr(a).endsWith(normalizeStr(b)),
    };

    return dataArray.filter(item => {
        for (const [field, type] of Object.entries(modelFields)) {
            const queryVal = query[field];
            if (queryVal === undefined) continue;

            const itemVal = item[field];

            if (typeof queryVal === 'object' && !Array.isArray(queryVal)) {
                // Operadores múltiples
                for (const op in queryVal) {
                    const opFunc = operators[op];
                    if (!opFunc) continue;

                    let castedQueryVal;
                    try {
                        castedQueryVal = castValueByType(queryVal[op], type);
                    } catch (err) {
                        const error = new Error(`Field '${field}' operator '${op}': ${err.message}`);
                        error.name = 'InvalidQueryFields';
                        throw error;
                    }

                    if (!opFunc(itemVal, castedQueryVal)) return false;
                }
            } else {
                // Igualdad simple
                let castedQueryVal;
                try {
                    castedQueryVal = castValueByType(queryVal, type);
                } catch (err) {
                    const error = new Error(`Field '${field}': ${err.message}`);
                    error.name = 'InvalidQueryFields';
                    throw error;
                }
                if (type === 'string') {
                    if (normalizeStr(String(itemVal)) !== normalizeStr(String(castedQueryVal))) return false;
                } else {
                    if (itemVal !== castedQueryVal) return false;
                }

            }
        }
        return true;
    });
}


/**
 * Convierte un valor en un tipo especificado
 */
function castValueByType(value, type) {
    switch (type) {
        case 'number':
            if (isNaN(Number(value))) {
                throw new Error(`Invalid number value: '${value}'`);
            }
            return Number(value);

        case 'boolean':
            if (value === 'true' || value === true) return true;
            if (value === 'false' || value === false) return false;
            throw new Error(`Invalid boolean value: '${value}'`);

        case 'date':
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date value: '${value}'`);
            }
            return date;

        case 'string':
        default:
            return String(value);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Formatea un valor según su tipo para usarlo en una query de IGDB.
 * - Strings se devuelven entre comillas dobles.
 * - Números y booleanos se devuelven como string sin comillas.
 * - Fechas se convierten a timestamp UNIX (segundos).
 */
function formatValueForIGDB(value, type) {
    switch (type) {
        case 'number':
            if (isNaN(Number(value))) {
                throw new Error(`Invalid number value: '${value}'`);
            }
            return String(Number(value));

        case 'boolean':
            if (value === 'true' || value === true) return '1';
            if (value === 'false' || value === false) return '0';
            throw new Error(`Invalid boolean value: '${value}'`);

        case 'date':
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date value: '${value}'`);
            }
            return String(Math.floor(date.getTime() / 1000)); // UNIX timestamp en segundos

        case 'string':
        default:
            // Escapar comillas dobles por seguridad
            const safe = String(value).replace(/["\\]/g, '');
            return `"${safe}"`;
    }
}


function normalizeStr(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}



module.exports = { buildMongoFilter, buildIGDBFilter, filterData };