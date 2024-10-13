// models/Comments.js

/**
 * ESQUEMA PARA COMENTARIOS
 * Se almacenaran todos los comentarios de los posts
 * */

const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    entryID:{
        type: Number,
        required: true
    },
    previousComment:{
        type: Number,
        required: true
    },
    postedDate:{
        type: Date,
        required: true
    },
    userID:{
        type: Number,
        required: true
    },
    text:{
        type: String,
        required: true
    },
    hide:{
        type: Boolean
    },
    reported:{
        type: Boolean
    },
    reportReasons:{
        type: [String]
    },
    
});

module.exports = Comments = mongoose.model('comments', CommentSchema);