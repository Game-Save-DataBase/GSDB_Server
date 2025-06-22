// models/SaveDatas.js

/**
 * ESQUEMA PARA DATOS DE GUARDADO.
 * */

const mongoose = require('mongoose');

const SavesSchema = new mongoose.Schema({

    userID: { type: String, required: true },       //id del usuario registrado que ha realizado la subida
    gameID: { type: String, required: true },       //ID al juego en nuestra base de datos
    platformID: { type: Number, required: true },   //ID a una plataforma en nuestra base de datos 
    file: { type: String, default: "" },   //ruta en el servidor donde se guarda el archivo
    private: { type: Boolean, default: false },    //indica si es un archivo que no se verá por el resto de usuarios
    title: { type: String, required: true, default: "Archivo de guardado" }, //nombre del archivo que se mostrará
    description: { type: String, default: "" },    //descripcion del archivo
    postedDate: { type: Date, default: Date.now },    // to do: meter un last update date
    nDownloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0 } //valoracion del save
});

/**
 * campos del modelo por los cuales se podra filtrar y su tipo en una cadena
 */
const filterFields = {
    userID: 'string',
    gameID: 'string',
    platformID: 'number',
    private: 'boolean',
    title: 'string',
    description: 'string',
    postedDate: 'date',
    nDownloads: 'number',
    rating: 'number'
};

const SaveDatas = mongoose.model('savedatas', SavesSchema);

module.exports = { SaveDatas, filterFields };