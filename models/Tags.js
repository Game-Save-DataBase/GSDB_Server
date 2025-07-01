// models/Tags.js

/**
 * ESQUEMA PARA TAGS
 * Se almacenaran las tags para categorizar los savedatas
 * */

const mongoose = require('mongoose');

const TagsSchema = new mongoose.Schema({
    name: { type: String, required: true },     // nombre del tag que se mostrará
    description: { type: String, default: "" },    // descripcion del tag
});


const filterFields ={
    name: 'string',
}

const Tags = mongoose.models.Tags || mongoose.model('tags', TagsSchema);

module.exports = {Tags, filterFields}