// models/Platforms.js

/**
 * ESQUEMA PARA PLATAFORMAS
 * Plataformas extraidas de IGDB. 
 * https://api-docs.igdb.com/#platform
 * */

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const PlatformSchema = new mongoose.Schema({
    abbreviation: { type: String, required: true },       //STRING UNICO. Las plataformas que tienen este valor SON LAS QUE HAY QUE USAR. Porque existen algunas como "dsi" que tenemos que ignorar, y esas no tienen abbreviation.      //titulo del juego
    generation: { type: Number, required: true },    //generacion de la consola
    name: { type: String, required: true },       //nombre que se utilizara visualmente
    slug: { type: String, required: true },       //A url-safe, unique, lower-case version of the name
    logo: { type: String, required:true }, //url del logo extraido de la base de datos de logos de igdb
    family: { type: String, required:true }, //familia extraida de la base de datos de familia (name)
    url: { type: String, required:true }, //url de igdb
    IGDB_ID: {type: Number, required:true}//id de igdb
});
PlatformSchema.plugin(AutoIncrement, { inc_field: 'platformID', start_seq: 0 });

const filterFields = {
    abbreviation: 'string',
    generation: 'number',    
    name: 'string', 
    family:'string',
    slug: 'string',      
    family: 'string',
    IGDB_ID: 'number'
};
//IDS UTILES: 6 - windows pc, 14 - mac, 3 - linux, 13 - DOS

const Platforms = mongoose.models.Platforms || mongoose.model('Platforms', PlatformSchema);
module.exports = {Platforms,filterFields}