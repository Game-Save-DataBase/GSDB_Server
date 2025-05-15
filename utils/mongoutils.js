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

    //mapeamos todas las funcionalidades de mongodb (lo que sería un where)
    //gt: greater than. gte: greater than equal. etc
    const mongoOpMap = { gt: '$gt', gte: '$gte', lt: '$lt', lte: '$lte', eq: '$eq', ne: '$ne' };

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
                        val = castValueByType(val, type);
                        filter[field][mongoOp] = val;
                    }
                }
            } else {
                //no tiene operadores
                let val = value;
                val = castValueByType(val, type);
                filter[field] = val;
            }
        }
    }

    return filter;
}

/**
 * Convierte un valor en un tipo especificado
 */
function castValueByType(value, type) {
    switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value === 'true' || value === true;
        case 'date':
            return new Date(value);
        case 'string':
        default:
            return String(value);
    }
}
module.exports = { buildMongoFilter };