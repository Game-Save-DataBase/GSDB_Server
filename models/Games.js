// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */
const config = require('../utils/config');
const { sendNotification } = require('../scripts/sendNotification');
const { SaveDatas } = require('./SaveDatas');
const { Users } = require('./Users');
let gamesToDelete = [];

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
            platformID: { type: Number, required: true }, //id de nuestras plataformas
            platformName: { type: String, required: false }, // nombre visible que viene de pcgw
            locations: { type: [String], required: true } //rutas
        }
    ],
    nUploads: { type: Number, default: 0 },
    lastUpdate: { type: Date, default: null }
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

        const updates = {
            $inc: { nUploads: 1 },
            $set: { lastUpdate: new Date() }
        };
        if (doc.userFav.length > 0) {
            await sendNotification({
                userIDs: doc.userFav,
                type: 2,
                args: { game: doc }
            });
        }
        await doc.updateOne(updates);
        next();
    } catch (err) {
        console.error('Error in Games post-save hook:', err);
        next(err);
    }
});

GameSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
    try {
        const game = await this.model.findOne(this.getFilter(), 'gameID').lean();
        gamesToDelete = game ? [game.gameID] : [];
    } catch (err) {
        console.error('Error capturando gameID en pre deleteOne:', err);
        gamesToDelete = [];
    }
    next();
});

GameSchema.pre('deleteMany', async function (next) {
    try {
        const games = await this.model.find(this.getFilter(), 'gameID').lean();
        gamesToDelete = games.map(g => g.gameID);
    } catch (err) {
        console.error('Error capturando gameIDs en pre deleteMany:', err);
        gamesToDelete = [];
    }
    next();
});

// ---------- ELIMINAR DATOS RELACIONADOS ----------
async function handleGameDeletion() {
    if (!gamesToDelete.length) return;

    try {
        // 1. Eliminar todos los saves asociados a estos gameID
        await SaveDatas.deleteMany({ gameID: { $in: gamesToDelete } });

        // 2. Eliminar gameIDs de favGames en Users
        await Users.updateMany(
            { favGames: { $in: gamesToDelete } },
            { $pull: { favGames: { $in: gamesToDelete } } }
        );

        console.log(`Juegos eliminados: ${gamesToDelete.join(', ')} y datos asociados limpiados.`);
    } catch (err) {
        console.error('Error eliminando datos asociados a gameID:', err);
    } finally {
        gamesToDelete = [];
    }
}

GameSchema.post('deleteOne', { document: false, query: true }, async function () {
    await handleGameDeletion();
});

GameSchema.post('deleteMany', async function () {
    await handleGameDeletion();
});



const Games = mongoose.models.Games || mongoose.model('games', GameSchema);
module.exports = { Games }