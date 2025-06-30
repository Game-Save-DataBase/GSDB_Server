/**
 * REGISTRO DE MODELOS.
 * Esto nos sirve para los filtros relacionales de las query, para saber como se relaciona cada modelo.
 * Devuelve:
 * - modelo
 * - campos por los que se puede filtrar en mongoDB
 * - campos por los que se puede filtrar en igdb (si se pudiese)
 * - foreignKey: nombre que tiene el ID de esta tabla en otros modelos
 *              -> es decir, si en savefiles queremos hacer referencia a su juego, debemos usar "gameID". Esa seria la foreignKey del modelo Games
 */

const modelRegistry = {
    platform: {
        model: require('./Platforms').Platforms,
        filterFields: require('./Platforms').filterFields,
        foreignKey: 'platformID',
    },
    savedata: {
        model: require('./SaveDatas').SaveDatas,
        filterFields: require('./SaveDatas').filterFields,
        foreignKey: 'saveID',
    },
    user: {
        model: require('./Users').Users,
        filterFields: require('./Users').filterFields,
        foreignKey: 'userID',
    },
    game: {
        model: require('./Games').Games,
        filterFields: require('./Games').filterFields,
        foreignKey: 'gameID',
    },
    comment: {
        model: require('./Comments').Comments,
        filterFields: require('./Comments').filterFields,
        foreignKey: 'commentID',
    },
};

/**
 * Devuelve la definición de un modelo registrado por nombre.
 * @param {string} modelName - Nombre del modelo (clave del registro)
 * @returns {{model: any, filterFields: object, foreignKey: string}} definición del modelo
 */
function getModelDefinition(modelName) {
    const def = modelRegistry[modelName];
    if (!def) {
        throw new Error(`Model "${modelName}" is not registered in modelRegistry.`);
    }
    return def;
}

module.exports = {
    modelRegistry,
    getModelDefinition,
};
