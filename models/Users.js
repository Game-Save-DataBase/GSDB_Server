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
        type: String,
        default: ""
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
        type: [String],
        default: [""]
    },
    favSaves:{
        type: [String],
        default: [""]
    },
    following:{
        type:[String],
        default: [""]
    },
    followers:{
        type:[String],
        default: [""]
    },
    entries:{
        type: [String],
        default: [""]
    },
    avatar:{
        type: String,
        default: "/src/assets/users/pfp/example.png"
    },
    bio:{
        type: String
    },
    downloadHistory:{
        type: [String],
        default: [""]
    }
    
});

module.exports = Users = mongoose.model('Users', UserSchema);