// models/SaveDatas.js

/**
 * ESQUEMA PARA DATOS DE GUARDADO.
 * */

const mongoose = require('mongoose');

const SavesSchema = new mongoose.Schema({

    userID: { type: String, required: true },       //id del usuario registrado que ha realizado la subida
    gameID: { type: String, required: true },       //ID al juego en nuestra base de datos
    platformID: { type: Number, required: true },   //ID a una plataforma en nuestra base de datos 
    file: { type: String, default: "", required: true },   //ruta en el servidor donde se guarda el archivo
    private: { type: Boolean, required: true, default: false },    //indica si es un archivo que no se verá por el resto de usuarios
    title: { type: String, required: true, default: "Archivo de guardado" }, //nombre del archivo que se mostrará
    description: { type: String, required: true, default: "" },    //descripcion del archivo
    postedDate: { type: Date, required: true, default: Date.now },    // to do: meter un last update date
    nDownloads: { type: Number, required: true, default: 0 }


});

module.exports = SaveDatas = mongoose.model('savedatas', SavesSchema);