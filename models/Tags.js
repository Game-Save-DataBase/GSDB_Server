// models/Tags.js

/**
 * ESQUEMA PARA TAGS
 * Se almacenaran las tags para categorizar los savedatas
 * */

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const TagsSchema = new mongoose.Schema({
    name: { type: String, required: true },     // nombre del tag que se mostrará
    description: { type: String, default: "" },    // descripcion del tag
});
TagsSchema.plugin(AutoIncrement, { inc_field: 'tagID', start_seq: 0 });

const Tags = mongoose.models.Tags || mongoose.model('tags', TagsSchema);

module.exports = {Tags}