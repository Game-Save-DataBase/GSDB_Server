// models/Users.js

/**
 * ESQUEMA PARA USUARIOS
 * Contrendra la informacion de cada usuario registrado
 * */
const config = require('../utils/config');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); //usamos bcryptjs en lugar de bcrypt porque bcryptjs no tiene dependencias de c++, es todo js.

const UserSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },     //nombre del usuario
    alias: { type: String, default: "" },           //nombre de usuario con el que quiere que se le identifique publicamente
    mail: { type: String, required: true, unique: true },         //indica si es un administrador de la pagina
    password: { type: String, required: true },  //estara encriptada
    admin: { type: Boolean, default: false },       //indica si es un usuario con privilegios
    verified: { type: Boolean, default: false },    //indica si es un usuario verificado
    rating: {type: Number, default: 0},             //valoracion del usuario 
    favGames: { type: [String], default: [""] },    //lista de juegos marcados como favoritos
    favSaves: { type: [String], default: [""] },    //lista de archivos marcados como favoritos
    following: { type: [String], default: [""] },   //lista de usuarios a los que sigue
    followers: { type: [String], default: [""] },   //lista de usuarios que le siguen
    uploads: { type: [String], default: [""] },       //lista de archivos subidos por este usuario
    pfp: { type: String, default: config.paths.pfp_default }, //imagen de perfil
    banner: {type: String, default: config.paths.banner_default}, //imagen de banner de perfil
    bio: { type: String, default: "" },                  //biografia/descripcion del usuario
    downloadHistory: { type: [String], default: [""] }  //historial de descargas del usuario

});

// Hashear la contraseña antes de guardar
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10); //salt = valor aleatorio
    this.password = await bcrypt.hash(this.password, salt); //hashea la contraseña
    next();
});

module.exports = Users = mongoose.model('Users', UserSchema);