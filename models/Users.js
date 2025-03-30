// models/Users.js

/**
 * ESQUEMA PARA USUARIOS
 * Contrendra la informacion de cada usuario registrado
 * */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userName: { type: String, required: true },     //nombre del usuario
    alias: { type: String, default: "" },           //nombre de usuario con el que quiere que se le identifique publicamente
    mail: { type: String, required: true },         //indica si es un administrador de la pagina
    admin: { type: Boolean, default: false },       //indica si es un usuario con privilegios
    verified: { type: Boolean, default: false },    //indica si es un usuario verificado
    favGames: { type: [String], default: [""] },    //lista de juegos marcados como favoritos
    favSaves: { type: [String], default: [""] },    //lista de archivos marcados como favoritos
    following: { type: [String], default: [""] },   //lista de usuarios a los que sigue
    followers: { type: [String], default: [""] },   //lista de usuarios que le siguen
    uploads: { type: [String], default: [""] },       //lista de archivos subidos por este usuario
    pfp: { type: String, default: "/assets/default/pfp.png" }, //imagen de perfil
    bio: { type: String, default: ""},                  //biografia/descripcion del usuario
    downloadHistory: { type: [String], default: [""] }  //historial de descargas del usuario

});

module.exports = Users = mongoose.model('Users', UserSchema);