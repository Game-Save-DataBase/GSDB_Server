// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */
const config = require('../utils/config');
const { sendNotification } = require('../scripts/sendNotification');

const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    gameID: { type: Number, required: true }, //SAME AS IGDB
    title: { type: String, required: true },             //titulo del juego
    release_date: { type: Date },
    slug: { type: String, required: true, unique: true },
    platformID: { type: [Number], required: true },    //ID de todas las plataformas en las que existen saves para este juego
    saveID: { type: [Number], default: [] },       //todos los ID de los saves subidos para este juego
    cover: { type: String, default: config.paths.gameCover_default }, //ruta de la imagen caratula  
    screenshot: { type: String, default: config.paths.banner_default }, //ruta de la imagen caratula  
    IGDB_url: { type: String, required: false },
    PCGW_ID: { type: String }, //es lo que se usa al final de la url
    PCGW_url: { type: String },
    external: { type: Boolean, required: true },
    userFav: { type: [Number], default: [] },    //usuarios que marcaron el juego como favorito
    saveLocations: [
        {
            platformID: { type: Number, required: true }, //id de nuestras plataformas (las de igdb)
            platformName: { type: String, required: false }, // nombre visible que viene de pcgw
            locations: { type: [String], required: true } //rutas
        }
    ],
    nUploads: {type: Number, default:0}
});


GameSchema.pre('save', async function (next) {
    if (this.isModified('saveID')) {
        try {
            const previous = await this.constructor.findById(this._id).lean();
            previousSaveIDs = previous?.saveID || [];
        } catch (err) {
            console.error('Error in Game pre-save hook:', err);
            previousSaveIDs = [];
        }
    } else {
        previousSaveIDs = null;
    }
    next();
});

GameSchema.post('save', async function (doc, next) {
    try {
        if (!previousSaveIDs) return next();

        const prevSet = new Set(previousSaveIDs);
        const newSaves = doc.saveID.filter(save => !prevSet.has(save));
        if (newSaves.length === 0) return next();

        if (doc.userFav.length > 0) {
            await sendNotification({
                userIDs: doc.userFav,
                type: 2,
                args: { game: doc }
            });
        }
        doc.nUploads+=1;
        next();
    } catch (err) {
        console.error('Error in Games post-save hook:', err);
        next(err);
    }
});


const Games = mongoose.models.Games || mongoose.model('games', GameSchema);
module.exports = { Games }