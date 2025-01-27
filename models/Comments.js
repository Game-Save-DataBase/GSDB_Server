// models/Comments.js

/**
 * ESQUEMA PARA COMENTARIOS
 * Se almacenaran todos los comentarios de los posts
 * */

const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    entryID:{
        type: String,
        required: true
    },
    previousComment:{
        type: String,
        default: ""
    },
    postedDate:{
        type: Date,
        default: Date.Now
    },
    userID:{
        type: String,
        required: true
    },
    text:{
        type: String,
        required: true
    },
    hide:{
        type: Boolean,
        default: false
    },
    reported:{
        type: Boolean,
        default:false
    },
    reportReasons:{
        type: [String],
        default: [""]
    },
    
});

module.exports = Comments = mongoose.model('comments', CommentSchema);