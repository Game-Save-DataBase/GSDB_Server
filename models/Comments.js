// models/Comments.js

/**
 * ESQUEMA PARA COMENTARIOS
 * Se almacenaran todos los comentarios de los posts
 * */

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const CommentSchema = new mongoose.Schema({

    userID: { type: Number, required: true }, //usuario que ha publicado el comentario
    saveID: { type: Number, required: true }, //save al cual esta relacionado este comentario
    text: { type: String, required: true }, //texto del comentario
    postedDate: { type: Date, default: Date.now }, //fecha de publicaicon del comentario
    previousComment: { type: Number, default: "" }, //comentario previo (al que responde) (para ordenar como arbol)
    hide: { type: Boolean, default: false }, //indica si este comentario se debe esconder
    reported: { type: Boolean, default: false }, //indica si este comentario ha sido reportado
    reportReasons: { type: [String], default: [] } //indica las razones por la cual el comentario ha sido reportado
        
});
CommentSchema.plugin(AutoIncrement, { inc_field: 'commentID', start_seq: 0 });


const filterFields ={
    userID: 'Number',
    saveID: 'Number',
    text:'string',
    postedDate: 'date',
    previousComment:'Number',
    hide:'boolean',
    reported:'boolean'
}

const Comments = mongoose.models.Comments || mongoose.model('comments', CommentSchema);

module.exports = {Comments, filterFields}