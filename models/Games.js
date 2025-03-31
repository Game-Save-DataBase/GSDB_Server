// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */

const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    title: { type: String, required: true },             //titulo del juego
    platformsID: { type: [Number], required: true },    //ID de todas las plataformas en las que existen saves para este juego
    savesID: { type: [String], default: [""] },       //todos los ID de los saves subidos para este juego
    cover: { type: String, default: "/assets/default/gameCover.jpg" } //ruta de la imagen caratula  
});

module.exports = Games = mongoose.model('games', GameSchema);