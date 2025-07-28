// models/SaveDatas.js

/**
 * ESQUEMA PARA DATOS DE GUARDADO.
 * */

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const config = require('../utils/config');
const fs = require('fs/promises');
const path = require('path');
const uploadsBasePath = path.join(__dirname, '..', config.paths.uploads);

const SavesSchema = new mongoose.Schema({
    userID: { type: Number, required: true },       //id del usuario registrado que ha realizado la subida
    gameID: { type: Number, required: true },       //ID al juego en nuestra base de datos
    platformID: { type: Number, required: true },   //ID a una plataforma en nuestra base de datos 
    file: { type: String, default: "" },   //nombre del archivo en el servidor
    fileSize: { type: Number, default: 0 },   //tamaño en bytes
    private: { type: Boolean, default: false },    //indica si es un archivo que no se verá por el resto de usuarios
    title: { type: String, required: true, default: "Archivo de guardado" }, //nombre del archivo que se mostrará
    description: { type: String, default: "" },    //descripcion del archivo
    postedDate: { type: Date, default: Date.now },    // to do: meter un last update date
    nDownloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }, //valoracion del save
    tags: { type: [String], required: false } // ids de las tag asociadas a este save
});
SavesSchema.plugin(AutoIncrement, { inc_field: 'saveID', start_seq: 0 });
SavesSchema.pre('deleteOne', { document: false, query: true }, async function(next) {
  this._docToDelete = await this.model.findOne(this.getFilter()).lean();
  next();
});

SavesSchema.post('deleteOne', { document: false, query: true }, async function() {
  const doc = this._docToDelete;
  if (!doc) return; 

  const saveDir = path.join(uploadsBasePath, String(doc.saveID));

  try {
    await fs.rm(saveDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`Error deleting data for saveID ${doc.saveID}:`, err);
  }
});

SavesSchema.post('deleteMany', async function () {
  try {
    const folders = await fs.readdir(uploadsBasePath, { withFileTypes: true });

    const deletions = folders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => fs.rm(path.join(uploadsBasePath, dirent.name), { recursive: true, force: true }));

    await Promise.all(deletions);
  } catch (fsErr) {
    console.error('error wiping savefile data:', fsErr);
  }
});

const SaveDatas =  mongoose.models.SaveDatas || mongoose.model('savedatas', SavesSchema);

module.exports = { SaveDatas };