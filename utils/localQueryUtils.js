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
    let sortObj = null;

    // Extraer limit offset y sort
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

    if (query.sort && typeof query.sort === 'object') {
        const sortField = Object.keys(query.sort)[0];
        const sortOrderKey = Object.keys(query.sort[sortField])[0]; 

        // Validar que el campo esté permitido
        if (modelDef.filterFields && modelDef.filterFields.includes(sortField)) {
            sortObj = { [sortField]: sortOrderKey.toLowerCase() === 'asc' ? 1 : -1 };
        }

    }
    delete query.sort;

    try {
        const filter = await buildMongoFilter(query, modelName, []);
        let mongoQuery = modelDef.model.find(filter);

        // Aplicar sort si existe, si no ordenar por id
        if (sortObj) {
            mongoQuery = mongoQuery.sort(sortObj);
        } else {
            mongoQuery = mongoQuery.sort({ [modelDef.foreignKey]: -1 }); // Orden por id descendente
        }

        const results = await mongoQuery
            .skip(offset)
            .limit(limit)
            .lean();

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
    if (!query || !Object.keys(query).length) return {};

    const { filterFields, foreignKey } = getModelDefinition(modelName);
    const allowedKeys = [...Object.keys(filterFields), '_id', 'id'];

    const { directFilters, relationalFilters } = separateFilters(query, allowedKeys);

    // id alias
    if (directFilters.id !== undefined) {
        directFilters[foreignKey] = directFilters.id;
        delete directFilters.id;
    }

    const filter = {};

    // Procesar relacionales (por campo): devuelve { andConditions: { fk: {...} }, orConditions: [ {...}, ... ] }
    const { andConditions: relationalAnd, orConditions: relationalOr } = await processRelationalFilters(relationalFilters, visitedRelations);

    // Procesar directos (por campo)
    const { andConditions: directAnd, orConditions: directOr } = processDirectFilters(directFilters, filterFields);

    // Combinar AND (simple asignación; contiene campos directos + fk: {$in: [...]})
    Object.assign(filter, relationalAnd, directAnd);

    // Combinar OR (array de condiciones objeto). NO borramos claves del root: permitimos AND + OR contradictorio intencionalmente.
    const orCombined = [...relationalOr, ...directOr];
    if (orCombined.length) {
        filter.$or = orCombined;
    }

    // Manejar filtro especial _id si existe
    processIdFilter(filter, directFilters._id);

    return filter;
}
function separateFilters(query, allowedKeys) {
    const relationalFilters = {};
    const directFilters = {};

    for (const key in query) {
        if (key.includes('.')) {
            const [relation, ...rest] = key.split('.');
            const inner = rest.join('.');
            if (!relationalFilters[relation]) relationalFilters[relation] = {};
            if (relationalFilters[relation][inner]) throw new Error(`Duplicate relational filter: ${relation}.${inner}`);
            relationalFilters[relation][inner] = query[key];
        } else {
            if (!allowedKeys.includes(key)) throw new Error(`Invalid parameter: ${key}`);
            if (directFilters[key]) throw new Error(`Duplicate direct filter: ${key}`);
            directFilters[key] = query[key];
        }
    }

    return { directFilters, relationalFilters };
}
async function processRelationalFilters(relationalFilters, visitedRelations = []) {
    const andConditions = {}; // { foreignKey: { $in: [...] } }
    const orConditions = [];  // [ { foreignKey: { $in: [...] } }, ... ]

    if (!relationalFilters || Object.keys(relationalFilters).length === 0) return { andConditions, orConditions };
    if (!Array.isArray(visitedRelations)) visitedRelations = [visitedRelations];

    for (const relation of Object.keys(relationalFilters)) {
        if (visitedRelations.includes(relation)) continue;

        const subFilters = relationalFilters[relation]; // e.g. { title: {...}, description: {...} }

        // --- AND-subquery: todos los campos sin __or (combinados en una sola búsqueda sobre el modelo relacionado)
        const andSubQuery = {};
        for (const [innerField, raw] of Object.entries(subFilters)) {
            const isOr = raw && typeof raw === 'object' && raw.__or;
            if (!isOr) {
                andSubQuery[innerField] = raw;
            }
        }
        if (Object.keys(andSubQuery).length > 0) {
            // build subfilter para la relación con todos los campos AND juntos
            // esto devuelve juegos que cumplan *todas* las condiciones AND de esta relación
            const subFilter = await buildMongoFilter(andSubQuery, relation, [...visitedRelations, relation]);
            const relationDef = getModelDefinition(relation);
            if (!relationDef) throw new Error(`Model definition for relation '${relation}' not found`);
            const keyField = relationDef.foreignKey || '_id';
            const relatedDocs = await relationDef.model.find(subFilter, { [keyField]: 1 }).lean();
            const ids = relatedDocs.map(d => d[keyField]);
            andConditions[keyField] = ids.length ? { $in: ids } : { $in: [null] };
        }

        // --- OR-subqueries: cada campo con __or produce su propia condición (cada una se meterá en $or)
        for (const [innerField, raw] of Object.entries(subFilters)) {
            const isOr = raw && typeof raw === 'object' && raw.__or;
            if (!isOr) continue;
            // crear una subconsulta con solo ese campo (eliminando __or)
            const value = { ...raw };
            delete value.__or;
            const singleFieldQuery = { [innerField]: value };

            const subFilter = await buildMongoFilter(singleFieldQuery, relation, [...visitedRelations, relation]);

            const relationDef = getModelDefinition(relation);
            if (!relationDef) throw new Error(`Model definition for relation '${relation}' not found`);
            const keyField = relationDef.foreignKey || '_id';
            const relatedDocs = await relationDef.model.find(subFilter, { [keyField]: 1 }).lean();
            const ids = relatedDocs.map(d => d[keyField]);
            const condition = { [keyField]: ids.length ? { $in: ids } : { $in: [null] } };
            orConditions.push(condition);
        }
    }

    return { andConditions, orConditions };
}
function processDirectFilters(directFilters, filterFields) {
    const andConditions = {};
    const orConditions = [];

    if (!directFilters || Object.keys(directFilters).length === 0) return { andConditions, orConditions };

    for (const [field, type] of Object.entries(filterFields)) {
        if (!(field in directFilters)) continue;

        const rawValue = directFilters[field];
        const isOr = rawValue && typeof rawValue === 'object' && rawValue.__or;
        const valueWithoutFlag = isOr ? { ...rawValue } : rawValue;
        if (isOr) delete valueWithoutFlag.__or;

        const parsed = parseFilterValue(valueWithoutFlag, type, field);

        if (isOr) {
            orConditions.push({ [field]: parsed });
        } else {
            andConditions[field] = parsed;
        }
    }

    return { andConditions, orConditions };
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
                } else if ((mongoOp === '$in' || mongoOp === '$nin') && typeof v === 'string') {
                    // Split string into array and cast each element
                    v = v.split(',').map(val => castValueByType(val.trim(), subtype));
                } else {
                    v = castValueByType(v, subtype);
                }

                if (mongoOp === '$in' || mongoOp === '$nin' || isArray) {
                    if (typeof v === 'string') {
                        v = v.split(',').map(elem => castValueByType(elem.trim(), subtype));
                    } else if (!Array.isArray(v)) {
                        v = [castValueByType(v, subtype)];
                    }
                }

                if (isArray && mongoOp === '$eq') {
                    return { $all: v, $size: v.length };
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

function processIdFilter(filter, idFilter) {
    if (!idFilter) return;
    if (typeof idFilter === 'string' || typeof idFilter === 'number') {
        filter._id = idFilter;
    } else if (Array.isArray(idFilter)) {
        filter._id = { $in: idFilter };
    } else if (typeof idFilter === 'object') {
        Object.assign(filter, idFilter);
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