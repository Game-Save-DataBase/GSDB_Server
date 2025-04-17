// configuracion de todo lo relacionado con el archivo .env para poder realizar comprobaciones por encima

require('dotenv').config();

const config = {
    port: process.env.PORT,
    mongoUri: process.env.MONGO_URI,
    secretKey: process.env.SECRET_KEY,
    isDevMode: process.env.DEV_MODE === 'true',
    apiVersion: process.env.API_VERSION,
    connection: process.env.GSDB+process.env.PORT, //conexion: es decir, la ruta del servidor, en este caso localhost.
    //directorios utiles
    paths: {
        //no funcionara a no ser que venga precedido de connection (si se usa fuera de este proyecto)
        assetsFolder: process.env.DIR_ASSETS,
        uploads: process.env.DIR_ASSETS+process.env.DIR_UPLOADS,
        defaults: process.env.DIR_ASSETS+process.env.DIR_DEFAULT,
        gameCover_default: process.env.DIR_ASSETS+process.env.DIR_DEFAULT + '/' + process.env.ASSET_GAMECOVER,
        pfp_default: process.env.DIR_ASSETS+process.env.DIR_DEFAULT + '/' + process.env.ASSET_PFP
    },
    api:{
        api: process.env.API,
        //no funcionara a no ser de que venga precedido de connection
        games: process.env.API+process.env.API_GAMES,//localhost:PORT/api/games
        savedatas: process.env.API+process.env.API_SAVEDATAS,//localhost:PORT/api/savedatas
        comments: process.env.API+process.env.API_COMMENTS,//localhost:PORT/api/comments
        users: process.env.API+process.env.API_USERS,//localhost:PORT/api/users
        info: process.env.API+process.env.API_INFO,//localhost:PORT/api/info
        auth: process.env.API+process.env.API_AUTH//localhost:PORT/api/auth
    }

    //posibilidad de crear funciones para conseguir la ruta de un save o de un usuario. por ejemplo,
    //getUserPfp(string userId){
    // return paths.users + '_bunchofnumbers'+'pfp.png'
    //}
    //o lo mismo con los saves
};

module.exports = config;