// models/Comments.js

/**
 * ESQUEMA PARA COMENTARIOS
 * Se almacenaran todos los comentarios de los posts
 * */

const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({

    userID: { type: String, required: true }, //usuario que ha publicado el comentario
    saveID: { type: String, required: true }, //save al cual esta relacionado este comentario
    text: { type: String, required: true }, //texto del comentario
    postedDate: { type: Date, default: Date.now }, //fecha de publicaicon del comentario
    previousComment: { type: String, default: "" }, //comentario previo (al que responde) (para ordenar como arbol)
    hide: { type: Boolean, default: false }, //indica si este comentario se debe esconder
    reported: { type: Boolean, default: false }, //indica si este comentario ha sido reportado
    reportReasons: { type: [String], default: [""] } //indica las razones por la cual el comentario ha sido reportado
        
});

module.exports = Comments = mongoose.model('comments', CommentSchema);