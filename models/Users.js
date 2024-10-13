// models/Users.js

/**
 * ESQUEMA PARA USUARIOS
 * Contrendra la informacion de cada usuario registrado
 * */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    //nombre del usuario
    name: {
        type: String,
        required: true
    },
    //nombre de usuario con el que quiere que se le identifique publicamente
    handleName:{
        type: String
    },
    mail:{
        type: String,
        required: true
    },
    //indica si es un administrador de la pagina
    admin:{
        type: Boolean,
        default: false
    },
    verified:{
        type:Boolean,
        default: false
    },
    favGames:{
        type: [Number]
    },
    favSaves:{
        type: [Number]
    },
    following:{
        type:[Number]
    },
    followers:{
        type:[Number]
    },
    entries:{
        type: [Number]
    },
    avatar:{
        type: String
    },
    bio:{
        type: String
    },
    downloadHistory:{
        type: [Number]
    }
    
});

module.exports = Users = mongoose.model('Users', UserSchema);