//funciones para interactuar con peticiones a mongodb

const { getModelDefinition } = require('../models/modelRegistry'); // Asumiendo que este es el archivo con modelRegistry

/**
 * Construye un filtro para MongoDB incluyendo filtros relacionales.
 * 
 * @param {Object} query - Parámetros de consulta recibidos (ej. req.query)
 * @param {Object} modelFields - Campos permitidos para filtrar en el modelo principal
 * @returns {Object} Filtro para usar directamente en MongoDB
 */
const mongoOpMap = {
    gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte',
    eq: '$eq', ne: '$ne', like: '$regex',
    start: '$regex', end: '$regex', in: '$in', nin: '$nin'
};


async function findByQuery(query, modelName) {
    const modelDef = getModelDefinition(modelName);
    if (!modelDef) throw new Error(`Model definition not found for model: ${modelName}`);

    let limit = 50;
    let offset = 0;

    if (query.limit) {
        const parsedLimit = parseInt(query.limit);
        if (!isNaN(parsedLimit) && parsedLimit > 0) limit = parsedLimit;
        delete query.limit;
    }

    if (query.offset) {
        const parsedOffset = parseInt(query.offset);
        if (!isNaN(parsedOffset) && parsedOffset >= 0) offset = parsedOffset;
        delete query.offset;
    }

    try {
        const filter = await buildMongoFilter(query, modelName);
        const results = await modelDef.model.find(filter).skip(offset).limit(limit).lean();
        return results;
    } catch (err) {
        throw {
            status: 400,
            error: 'FILTER_ERROR',
            message: err.message || 'Invalid filter'
        };
    }
}



/**
 * 
 * @param {string} query 
 * @param {string} modelName 
 * @returns resultado de buscar de manera rapida dentro del modelo, solamente si tiene en la query un id individual, ya sea de mongodb o del campo del modelo
 */
async function findByID(query, modelName) {
    const modelDef = getModelDefinition(modelName);
    if (!modelDef) throw new Error(`Model definition not found for ${modelName}`);

    const idField = modelDef.foreignKey || '_id';  // Campo ID real en la base
    const keys = Object.keys(query);
    if (keys.length !== 1) return undefined;  // Solo 1 campo permitido
    const key = keys[0];
    if (key !== '_id' && key !== 'id') return undefined; // Si el único campo no es id, no filtro rápido
    const value = query[key];
    if (typeof value === 'object') return undefined;

    // Solo aceptar valores simples (string o number o ObjectId)
    const isSimpleValue = val =>
        typeof val === 'string' || typeof val === 'number' || val instanceof require('mongoose').Types.ObjectId;

    if (!isSimpleValue(value)) return undefined; // Valor no simple, no filtro rápido

    const model = modelDef.model;

    if (key === '_id') {
        // Buscar por _id
        const doc = await model.findById(value);
        return doc || null;
    } else if (key === 'id') {
        // Buscar por campo id real
        const filter = { [idField]: value };
        const doc = await model.findOne(filter);
        return doc || null;
    }

    // No debería llegar aquí
    return undefined;
}

async function buildMongoFilter(query, modelName, visitedRelations = []) {
    if (!query || !Object.keys(query).length) return {};  // <-- Aquí el cambio

    const { filterFields, foreignKey } = getModelDefinition(modelName);
    const allowedKeys = [...Object.keys(filterFields), '_id', 'id'];

    // Separar filtros directos y relacionales
    const { directFilters, relationalFilters } = separateFilters(query, allowedKeys);
    if (directFilters.id !== undefined) {
        directFilters[foreignKey] = directFilters.id;
        delete directFilters.id;
    }

    // Construir filtro final
    const filter = {};

    // Procesar filtros relacionales recursivamente
    await processRelationalFilters(filter, relationalFilters, visitedRelations);

    // Procesar filtros directos
    processDirectFilters(filter, directFilters, filterFields);

    // Manejar _id especial
    processIdFilter(filter, directFilters._id);

    return filter;
}

function separateFilters(query, allowedKeys) {
    const relationalFilters = {};
    const directFilters = {};

    for (const key in query) {
        if (key.includes('.')) {
            const [relation, ...rest] = key.split('.');
            if (!relationalFilters[relation]) relationalFilters[relation] = {};
            if (relationalFilters[relation][rest.join('.')])
                throw new Error(`Duplicate relational filter: ${relation}.${rest.join('.')}`);
            relationalFilters[relation][rest.join('.')] = query[key];
        } else {
            if (!allowedKeys.includes(key)) throw new Error(`Invalid parameter: ${key}`);
            if (directFilters[key]) throw new Error(`Duplicate direct filter: ${key}`);
            directFilters[key] = query[key];
        }
    }
    return { directFilters, relationalFilters };
}

async function processRelationalFilters(filter, relationalFilters, visitedRelations) {
    for (const relation in relationalFilters) {
        if (visitedRelations.includes(relation)) continue;

        const subFilter = await buildMongoFilter(relationalFilters[relation], relation, [...visitedRelations, relation]);

        const relationDef = getModelDefinition(relation);
        if (!relationDef) throw new Error(`Model definition for relation '${relation}' not found`);

        const keyField = relationDef.foreignKey || '_id';

        let ids = [];

        if (relation === 'game') {
            // Lógica para usar búsqueda externa de juegos
            const externalGames = await searchGamesFromIGDB(subFilter);
            ids = externalGames.map(g => g[keyField]).filter(Boolean);
        } else {
            const relatedDocs = await relationDef.model.find(subFilter, { [keyField]: 1 }).lean();
            ids = relatedDocs.map(d => d[keyField]);
        }

        if (filter[keyField]) throw new Error(`Duplicate relational filter key: ${keyField}`);

        filter[keyField] = ids.length ? { $in: ids } : { $in: [null] };
    }
}


function processDirectFilters(filter, directFilters, filterFields) {
    for (const [field, type] of Object.entries(filterFields)) {
        if (!(field in directFilters)) continue;
        if (filter[field]) throw new Error(`Duplicate filter for field: ${field}`);
        filter[field] = parseFilterValue(directFilters[field], type, field);
    }
}
function parseFilterValue(value, type, fieldName = 'unknown') {
    const isArray = type.startsWith('array:');
    const subtype = isArray ? type.split(':')[1] : type;

    if (typeof value === 'object' && !Array.isArray(value)) {
        const res = {};
        for (const op in value) {
            const mongoOp = mongoOpMap[op];
            if (!mongoOp) continue;

            try {
                let v = value[op];
                if (subtype === 'string' && mongoOp === '$regex') {
                    const norm = normalizeStr(String(v));
                    let pattern = norm;
                    if (op === 'like') pattern = `.*${escapeRegExp(norm)}.*`;
                    else if (op === 'start') pattern = `^${escapeRegExp(norm)}`;
                    else if (op === 'end') pattern = `${escapeRegExp(norm)}$`;
                    v = new RegExp(pattern, 'i');
                } else {
                    v = castValueByType(v, subtype);
                }

                if (isArray && mongoOp === '$eq') {
                    const elems = Array.isArray(v) ? v : [v];
                    return { $all: elems, $size: elems.length };
                }

                res[mongoOp] = v;
            } catch (err) {
                throw new Error(`filter ${fieldName}[${op}]=${value[op]} contains errors`);
            }
        }
        return res;
    }

    try {
        if (isArray) {
            const arrVal = Array.isArray(value) ? value : String(value).split(/[,;]/).map(s => s.trim());
            return { $all: castValueByType(arrVal, subtype) };
        }

        if (subtype === 'string') {
            return { $regex: new RegExp(`^${escapeRegExp(normalizeStr(value))}$`, 'i') };
        }

        return castValueByType(value, subtype);
    } catch (err) {
        throw new Error(`filter ${fieldName}= ${value} contains errors`);
    }
}


function processIdFilter(filter, idValue) {
    if (idValue === undefined) return;
    if (typeof idValue === 'string') {
        filter._id = idValue;
    } else if (Array.isArray(idValue)) {
        filter._id = { $in: idValue };
    }
}

function castValueByType(value, type) {
    if (type.startsWith('array:')) {
        const subtype = type.split(':')[1];

        try {
            if (Array.isArray(value)) return value.map(v => castValueByType(v, subtype));
            if (typeof value === 'string') return value.split(/[,;]/).map(v => castValueByType(v.trim(), subtype));
            return [castValueByType(value, subtype)];
        } catch (err) {
            throw err; // dejar que propague
        }
    }

    switch (type) {
        case 'string': return String(value);
        case 'number':
            const n = Number(value);
            if (isNaN(n)) {
                throw new Error(`Cannot cast "${value}" to number`);
            }
            return n;

        case 'boolean':
            if (value === 'true' || value === true) return true;
            if (value === 'false' || value === false) return false;
            throw new Error(`Cannot cast "${value}" to boolean`);

        case 'date':
            const d = new Date(value);
            if (isNaN(d.getTime())) {
                throw new Error(`Cannot cast "${value}" to date`);
            }
            return d;

        default:
            return value;
    }
}

function escapeRegExp(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeStr(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }



module.exports = { findByID, findByQuery };