// models/Platforms.js

/**
 * ESQUEMA PARA PLATAFORMAS
 * Plataformas extraidas de IGDB. 
 * https://api-docs.igdb.com/#platform
 * */
const config = require('../utils/config');

const mongoose = require('mongoose');

const PlatformSchema = new mongoose.Schema({
    abbreviation: { type: String, required: true },       //STRING UNICO. Las plataformas que tienen este valor SON LAS QUE HAY QUE USAR. Porque existen algunas como "dsi" que tenemos que ignorar, y esas no tienen abbreviation.      //titulo del juego
    generation: { type: Number, required: true },    //generacion de la consola
    name: { type: String, required: true },       //nombre que se utilizara visualmente
    slug: { type: String, required: true },       //A url-safe, unique, lower-case version of the name
    logo: { type: String, required:true }, //url del logo extraido de la base de datos de logos de igdb
    family: { type: String, required:true }, //familia extraida de la base de datos de familia (name)
    url: { type: String, required:true } //url de igdb

});

const filterFields = {
    abbreviation: 'string',
    generation: 'number',    
    name: 'string', 
    family:'string',
    slug: 'string',      
    family: 'string'
};


const Platforms = mongoose.model('platforms', PlatformSchema);
module.exports = {Platforms,filterFields}