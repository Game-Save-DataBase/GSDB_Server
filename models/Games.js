// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */
const config = require('../utils/config');

const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    title: { type: String, required: true },             //titulo del juego
    slug: { type: String, required: true, unique: true },
    platformsID: { type: [Number], required: true },    //ID de todas las plataformas en las que existen saves para este juego
    savesID: { type: [String], default: [] },       //todos los ID de los saves subidos para este juego
    cover: { type: String, default: config.paths.gameCover_default }, //ruta de la imagen caratula  
    IGDB_ID: { type: Number, required: true },
    IGDB_url: { type: String, required: false },
    external: { type: Boolean, required: true }
});

const filterFields = {
    title: 'string',
    platformsID: 'string', //aunque se guarden en un array, permitimos hacer un filtro rapido con una plataforma
    IGDB_ID: 'number',
    slug: 'string',
    external: 'boolean'
};
function mapFiltersToIGDB(localFilters) {
    if (!localFilters) return {};
    const mapped = {};
    for (const [key, value] of Object.entries(localFilters)) {
        if (key === 'platformsID') mapped['platforms'] = value;
        else if (key === 'title') mapped['name'] = value;
        else if (key === 'slug') mapped['slug'] = value;
        else if (key === 'IGDB_ID') mapped['id'] = value;
    }
    return mapped;
}


const Games = mongoose.models.Games || mongoose.model('games', GameSchema);
module.exports = { Games, filterFields,mapFiltersToIGDB }