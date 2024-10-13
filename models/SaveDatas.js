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
    //ruta en el servidor donde se guarda el archivo
    file:{
        type: String,
        default: "",
        required: true
    },
    //archivo de guardado personalizado por el usuario
    customPath:{
        type: String,
        default: ""
    },
    //id del usuario registrado que ha realizado la subida
    userID:{
        type: Number,
        required: true
    },
    //indica si es un archivo que no se verá por el resto de usuarios
    private:{
        type: Boolean,
        required: true,
        default: false
    },
    //descripcion del archivo
    description:{
        type: String,
        required: true,
        default: ""
    }
    

});

module.exports = SaveDatas = mongoose.model('savedatas', SavesSchema);