// models/Games.js

/**
 * ESQUEMA PARA JUEGOS.
 * Cada vez que un usuario añada un juego, se escoge uno según las entradas existentes en otras bases de datos.
 * Aprovecharemos bases de datos como IGDB o PCGW para añadir los juegos.
* De todas formas, guardamos aqui la informacion esencial para identificar nuestro juego
 * */

const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    //Titulo del juego. El resto de info, por ahora, en otras BBDD unicamente
    name: {
        type: String,
        required: true
    },
    //ID en nuestra BBDD de plataformas
    //TODO: Cambiar nombres de esto
    platformsID: {
        type: [String],
        required: true
    },
    // SAVE LOCATIONS: platforms y savepath siguen el mismo orden
    savePathID: {
        type: [String],
        default: ""
    },
    //ENTRADAS: ID de las entradas subidas relacionadas con este videojuego
    entriesID:{
         type: [Number],
        default: ""
    },
    //ID de otras BBDD para mas informacion
    IGDB_id: {
        type: Number,
        default: -1
    },
    PCGW_id: {
        type: Number,
        default: -1
    }
});

module.exports = Games = mongoose.model('games', GameSchema);