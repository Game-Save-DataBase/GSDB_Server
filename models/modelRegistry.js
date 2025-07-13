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
        foreignKey: 'platformID',
        filterFields: {
            platformID: 'number',
            abbreviation: 'string',
            generation: 'number',
            name: 'string',
            slug: 'string',
            family: 'string',
            IGDB_ID: 'number'
        },

    },
    savedata: {
        model: require('./SaveDatas').SaveDatas,
        foreignKey: 'saveID',
        putFields: ['title', 'description', 'private'],
        filterFields: {
            saveID: 'number',
            userID: 'number',
            gameID: 'number',
            platformID: 'number',
            private: 'boolean',
            title: 'string',
            description: 'string',
            postedDate: 'date',
            nDownloads: 'number',
            rating: 'number'
        },
    },
    user: {
        model: require('./Users').Users,
        putFields: ['alias', 'mail', 'password', 'bio'],
        filterFields: {
            userID: 'number',
            userName: 'string',
            alias: 'string',
            admin: 'boolean',
            verified: 'boolean',
            rating: 'number',
            favGames: 'array:number',
            favSaves: 'array:number',
            followers: 'array:number',
            following: 'array:number',
            uploads: 'array:number'
        },
        foreignKey: 'userID',

    },
    game: {
        model: require('./Games').Games,
        foreignKey: 'gameID',
        filterFields: {
            gameID: 'number',
            title: 'string',
            slug: 'string',
            platformID: 'array:number',
            saveID: 'array:number',
            external: 'boolean',
            release_date: 'date',
            userFav: 'array:number'
        },
        igdbFilterFields: {
            title: 'name',
            slug: 'slug',
            gameID: 'id',
            release_date: 'first_release_date',
            platformID: 'platforms'
        },
        localFields: ['saveID', 'userFav'],
    },
    comment: {
        model: require('./Comments').Comments,
        foreignKey: 'commentID',
        putFields: ['text', 'hide', 'reported'],
        filterFields: {
            commentID: 'number',
            userID: 'number',
            saveID: 'number',
            text: 'string',
            postedDate: 'date',
            previousComment: 'number',
            hide: 'boolean',
            reported: 'boolean',
            reportReasons: 'array:string'
        },
    },
    tag: {
        model: require('./Tags').Tags,
        foreignKey: 'tagID',
        putFields: ['name', 'description'],
        filterFields: {
            name: 'string',
            tagID: 'number'
        },
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

//devuelve true si una query es invalida para usar en los put
function hasStaticFields(query, modelName) {
    return Object.keys(query).some(key => !getModelDefinition(modelName).putFields.includes(key));
}
//devuelve true si una query que contiene valores que solo existen en mongodb, no en bases de datos externas
function hasLocalFields(query, modelName) {
    return Object.keys(query).some(key => getModelDefinition(modelName).localFields?.includes(key));
}

module.exports = {
    modelRegistry,
    getModelDefinition,
    hasStaticFields,
    hasLocalFields,
};
