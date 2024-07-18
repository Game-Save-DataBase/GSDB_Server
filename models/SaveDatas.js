// models/SaveDatas.js

/**
 * ESQUEMA PARA DATOS DE GUARDADO.
 * Este será el esquema principal que se utilizará.
 * Las subidas de los usuarios serán datos de guardado.
 * Cada archivo que se suba será un comprimido.
 * Se indicará por lo tanto la referencia a la plataforma del archivo de guardado y al videojuego.
 * Según la información en el esquema de un videojuego, se identificará cual será la ruta de guardado.
 * */

const mongoose = require('mongoose');

const SavesSchema = new mongoose.Schema({
    //ID al juego en nuestra base de datos
    gameID: {
        type: String,
        required: true
    },
    //ID a una plataforma en nuestra base de datos
    platformID:{
        type: String,
        required:true
    },
    file:{
        type: String,
        default: "sin implementar"
    }

});

module.exports = SaveDatas = mongoose.model('savedatas', SavesSchema);