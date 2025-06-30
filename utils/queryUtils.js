//funciones para interactuar con peticiones a mongodb

/**
 * Construye un filtro para MongoDB incluyendo filtros relacionales.
 * 
 * @param {Object} query - Parámetros de consulta recibidos (ej. req.query)
 * @param {Object} modelFields - Campos permitidos para filtrar en el modelo principal
 * @returns {Object} Filtro para usar directamente en MongoDB
 */
const { getModelDefinition } = require('../models/modelRegistry');

/**
 * Construye un filtro para MongoDB incluyendo filtros relacionales.
 * 
 * @param {Object} query - Parámetros de consulta recibidos (ej. req.query)
 * @param {Object} modelFields - Campos permitidos para filtrar en el modelo principal
 * @returns {Object} Filtro para usar directamente en MongoDB
 */
async function buildMongoFilter(query, modelFields, visitedRelations = []) {
    const filter = {};
    if (!query || Object.keys(query).length === 0) return undefined;

    const mongoOpMap = {
        gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte',
        eq: '$eq', ne: '$ne', like: '$regex',
        start: '$regex', end: '$regex', in: '$in', nin: '$nin'
    };

    const allowedKeys = Object.keys(modelFields);
    const relationalFilters = {};
    const directFilters = {};

    // Separar filtros directos y relacionales (anidados arbitrarios)
    for (const key of Object.keys(query)) {
        if (key.includes('.')) {
            const [relation, ...rest] = key.split('.');
            const subfield = rest.join('.');
            if (!relationalFilters[relation]) relationalFilters[relation] = {};
            if (relationalFilters[relation][subfield]) {
                const error = new Error(`Duplicate relational filter: ${relation}.${subfield}`);
                error.name = 'DuplicateFilterField';
                throw error;
            }
            relationalFilters[relation][subfield] = query[key];
        } else {
            if (!allowedKeys.includes(key) && key !== '_id' && key !== 'text') {
                const error = new Error(`Invalid parameter: ${key}`);
                error.name = 'InvalidQueryFields';
                throw error;
            }
            if (directFilters[key]) {
                const error = new Error(`Duplicate direct filter: ${key}`);
                error.name = 'DuplicateFilterField';
                throw error;
            }
            directFilters[key] = query[key];
        }
    }

    // Procesar filtros relacionales recursivamente
    for (const relation of Object.keys(relationalFilters)) {
        if (visitedRelations.includes(relation)) {
            // Evitar ciclos infinitos
            continue;
        }

        const relationDef = getModelDefinition(relation);
        if (!relationDef) {
            throw new Error(`Model definition for relation '${relation}' not found`);
        }

        const subQuery = relationalFilters[relation];
        // Recursividad: filtro para submodelo con acumulación de relaciones visitadas
        const subFilter = await buildMongoFilter(subQuery, relationDef.filterFields, [...visitedRelations, relation]);

        // Buscar IDs relacionados que cumplen filtro en submodelo
        const relatedDocs = await relationDef.model.find(subFilter, { _id: 0, IGDB_ID: 1 }).lean();
        const ids = relatedDocs.map(doc => doc.IGDB_ID);

        const foreignKey = relationDef.foreignKey;

        if (filter[foreignKey]) {
            const error = new Error(`Duplicate relational filter key: ${foreignKey}`);
            error.name = 'DuplicateFilterField';
            throw error;
        }

        filter[foreignKey] = ids.length > 0 ? { $in: ids } : { $in: [-99999999] };
    }

    // Procesar filtros directos
    for (const [field, type] of Object.entries(modelFields)) {
        const value = directFilters[field];
        if (value === undefined) continue;

        if (filter[field]) {
            const error = new Error(`Duplicate filter for field: ${field}`);
            error.name = 'DuplicateFilterField';
            throw error;
        }

        const isArray = isArrayType(type);

        if (typeof value === 'object' && !Array.isArray(value)) {
            // value con operadores { eq: ..., in: ..., etc }
            filter[field] = {};
            for (const op in value) {
                const mongoOp = mongoOpMap[op];
                if (!mongoOp) continue;

                const val = value[op];
                const castedVal = castValueByType(val, type);

                if (mongoOp === '$regex') {
                    if (!type.startsWith('string')) {
                        throw new Error(`Operator '${op}' only supported for type 'string'`);
                    }
                    const normalized = normalizeStr(String(val));
                    let pattern = normalized;
                    if (op === 'like') pattern = `.*${escapeRegExp(normalized)}.*`;
                    else if (op === 'start') pattern = `^${escapeRegExp(normalized)}`;
                    else if (op === 'end') pattern = `${escapeRegExp(normalized)}$`;
                    filter[field][mongoOp] = new RegExp(pattern, 'i');

                } else if (isArray) {
                    if (mongoOp === '$eq') {
                        // Igualdad exacta: todos y sólo esos elementos (sin importar orden)
                        const elems = Array.isArray(castedVal) ? castedVal : [castedVal];
                        filter[field] = {
                            $all: elems,
                            $size: elems.length
                        };
                    } else if (mongoOp === '$in') {
                        filter[field] = { $in: Array.isArray(castedVal) ? castedVal : [castedVal] };
                    } else if (mongoOp === '$nin') {
                        filter[field] = { $nin: Array.isArray(castedVal) ? castedVal : [castedVal] };
                    } else if (mongoOp === '$ne') {
                        // ne como opuesto a eq: no ser exactamente esos elementos
                        const elems = Array.isArray(castedVal) ? castedVal : [castedVal];
                        filter.$nor = filter.$nor || [];
                        filter.$nor.push({ [field]: { $all: elems, $size: elems.length } });
                    } else {
                        filter[field] = { $elemMatch: { [mongoOp]: castedVal } };
                    }

                } else {
                    // campo no array
                    filter[field][mongoOp] = castedVal;
                }
            }
        } else {
            // valor simple sin operador
            const casted = castValueByType(value, type);

            if (isArray) {
                // buscamos que el array contenga todos los elementos pasados
                filter[field] = { $all: Array.isArray(casted) ? casted : [casted] };
            } else if (type === 'string') {
                filter[field] = { $regex: new RegExp(`^${escapeRegExp(normalizeStr(value))}$`, 'i') };
            } else {
                filter[field] = casted;
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


function isArrayType(type) {
    return type.startsWith('array:');
}

function getArrayElementType(type) {
    return type.split(':')[1];
}

function castValueByType(value, type) {
    if (isArrayType(type)) {
        const subtype = getArrayElementType(type);
        if (Array.isArray(value)) {
            return value.map(v => castValueByType(v, subtype));
        }
        if (typeof value === 'string') {
            return value.split(/[,;]/).map(v => castValueByType(v.trim(), subtype));
        }
        return [castValueByType(value, subtype)];
    }

    switch (type) {
        case 'string': return String(value);
        case 'number': return Number(value);
        case 'boolean': return value === 'true' || value === true;
        case 'date': return new Date(value);
        default: return value;
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