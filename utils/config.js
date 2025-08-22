// configuracion de todo lo relacionado con el archivo .env para poder realizar comprobaciones por encima

require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const DIR_GSDB = isProd ? process.env.DIR_GSDB_PROD : process.env.DIR_GSDB + process.env.PORT;

const config = {
    port: process.env.PORT,
    mongoUri: process.env.MONGO_URI,
    secretKey: process.env.SECRET_KEY,
    isDevMode: process.env.DEV_MODE === 'true',
    apiVersion: process.env.API_VERSION,
    connection: DIR_GSDB, 
    refreshInterval: process.env.REFRESH_INTERVAL,
    //directorios utiles
    paths: {
        //no funcionara a no ser que venga precedido de connection (si se usa fuera de este proyecto)
        assetsFolder: process.env.DIR_ASSETS,
        uploads: process.env.DIR_ASSETS + process.env.DIR_UPLOADS,
        userProfiles: process.env.DIR_ASSETS + process.env.DIR_USERS,
        defaultsInAssetsFolder: process.env.DIR_ASSETS + process.env.DIR_DEFAULT,
        default: process.env.DIR_DEFAULT,
        gameCover_default: process.env.DIR_ASSETS + process.env.DIR_DEFAULT + '/' + process.env.ASSET_GAMECOVER,
        pfp_default: process.env.DIR_ASSETS + process.env.DIR_DEFAULT + '/' + process.env.ASSET_PFP,
        banner_default: process.env.DIR_ASSETS + process.env.DIR_DEFAULT + '/' + process.env.ASSET_BANNER
    },
    api: {
        api: process.env.API,
        //no funcionara a no ser de que venga precedido de connection
        games: process.env.API + process.env.API_GAMES,//localhost:PORT/api/games
        platforms: process.env.API + process.env.API_PLATFORMS,//localhost:PORT/api/platforms
        savedatas: process.env.API + process.env.API_SAVEDATAS,//localhost:PORT/api/savedatas
        comments: process.env.API + process.env.API_COMMENTS,//localhost:PORT/api/comments
        users: process.env.API + process.env.API_USERS,//localhost:PORT/api/users
        info: process.env.API + process.env.API_INFO,//localhost:PORT/api/info
        auth: process.env.API + process.env.API_AUTH,//localhost:PORT/api/auth
        tags: process.env.API + process.env.API_TAGS,//localhost:PORT/api/tags
        assets: process.env.API + process.env.API_ASSETS//localhost:PORT/api/assets
    },
    virusTotal: {
        apiKey: process.env.VT_API_KEY,
        scanUrl: 'https://www.virustotal.com/api/v3/files',
        reportUrl: 'https://www.virustotal.com/api/v3/analyses/', // + analysis_id
    },
    useVirusTotal: process.env.USE_VT === 'true'

};

module.exports = config;