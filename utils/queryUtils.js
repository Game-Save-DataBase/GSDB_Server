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

    //mapeamos todas las funcionalidades de mongodb (lo que sería un where)
    //gt: greater than. gte: greater than equal. etc
    //por ahora, permitimos todos los operandos en todos los tipos. Esto generara cosas raras como un >= para strings, pero, la programacion permite esto idk
    const mongoOpMap = { gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', eq: '$eq', ne: '$ne', like: '$regex' };

    const allowedKeys = Object.keys(modelFields);
    const invalidKeys = Object.keys(query).filter(k => !allowedKeys.includes(k) && k !== '_id' && k !== 'text');

    if (invalidKeys.length > 0) {
        const error = new Error(`Invalid parameters: ${invalidKeys.join(', ')}`);
        error.name = 'InvalidQueryFields';
        throw error;
    }


    //recorremos todos los campos permitidos
    for (const [field, type] of Object.entries(modelFields)) {
        const value = query[field]; //accedemos al valor introducido para el campo dentro de la query
        if (value !== undefined) {
            //si es de tipo objeto, significa que el valor contiene operadores por lo que debemos tratarlos
            if (typeof value === 'object' && !Array.isArray(value)) {
                filter[field] = {};
                //comprobamos los operadores que pueda tener el valor
                for (const op in value) {
                    const mongoOp = mongoOpMap[op];
                    if (mongoOp) {
                        let val = value[op];
                        try {
                            if (mongoOp === '$regex') {
                                if (type !== 'string') {
                                    throw new Error(`Operator 'like' only supported on type 'string'`);
                                }
                                val = String(val);
                                filter[field][mongoOp] = val;
                            }
                            else {
                                val = castValueByType(val, type);
                                filter[field][mongoOp] = val;
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
                    const val = castValueByType(value, type);
                    filter[field] = val;
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

function buildIGDBFilter(rawQuery, modelFields, mapFiltersFn) {
    if (!rawQuery || Object.keys(rawQuery).length === 0) return '';

    const igdbOpMap = {
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        eq: '=',
        ne: '!=',
        like: '~',   // "*val*"
        start: '~',  // "val*"
        end: '~'     // "*val"
    };

    const conditions = [];

    for (const [localField, type] of Object.entries(modelFields)) {
        const value = rawQuery[localField];
        if (value === undefined) continue;

        // Mapear el campo local a IGDB
        const igdbField = mapFiltersFn({ [localField]: 1 }) ? Object.keys(mapFiltersFn({ [localField]: 1 }))[0] : localField;

        if (typeof value === 'object' && !Array.isArray(value)) {
            for (const [op, valRaw] of Object.entries(value)) {
                const opSymbol = igdbOpMap[op];
                if (!opSymbol) continue;

                // Ignorar like sobre title (se usa search)
                if (op === 'like' && localField === 'title') continue;

                const val = String(valRaw).replace(/["\\]/g, '');

                if (op === 'like') {
                    conditions.push(`${igdbField} ${opSymbol} "*${val}*"`);
                } else if (op === 'start') {
                    conditions.push(`${igdbField} ${opSymbol} "${val}*"`);
                } else if (op === 'end') {
                    conditions.push(`${igdbField} ${opSymbol} "*${val}"`);
                } else if (typeof valRaw === 'string') {
                    conditions.push(`${igdbField} ${opSymbol} "${val}"`);
                } else {
                    conditions.push(`${igdbField} ${opSymbol} ${val}`);
                }
            }
        } else {
            // Valor simple = igualdad
            const val = String(value).replace(/["\\]/g, '');
            conditions.push(`${igdbField} = "${val}"`);
        }
    }

    return conditions.join(' & ');
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


module.exports = { buildMongoFilter, buildIGDBFilter };