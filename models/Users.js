// models/Users.js

/**
 * ESQUEMA PARA USUARIOS
 * Contrendra la informacion de cada usuario registrado
 * */
const config = require('../utils/config');

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const bcrypt = require('bcryptjs'); //usamos bcryptjs en lugar de bcrypt porque bcryptjs no tiene dependencias de c++, es todo js.
const { encrypt, decrypt } = require('../utils/encrypt.js');

const UserSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },     //nombre del usuario
    alias: { type: String, default: "" },           //nombre de usuario con el que quiere que se le identifique publicamente
    mail: { type: String, required: true, unique: true },         //indica si es un administrador de la pagina
    password: { type: String, required: true },  //estara encriptada
    admin: { type: Boolean, default: false },       //indica si es un usuario con privilegios
    verified: { type: Boolean, default: false },    //indica si es un usuario verificado
    rating: { type: Number, default: 0 },             //valoracion del usuario 
    favGames: { type: [Number], default: [] },    //lista de juegos marcados como favoritos
    favSaves: { type: [Number], default: [] },    //lista de archivos marcados como favoritos
    following: { type: [Number], default: [] },   //lista de usuarios a los que sigue
    followers: { type: [Number], default: [] },   //lista de usuarios que le siguen
    uploads: { type: [Number], default: [] },       //lista de archivos subidos por este usuario
    bio: { type: String, default: "" },                  //biografia/descripcion del usuario
    downloadHistory: { type: [String], default: [] },  //historial de descargas del usuario
    reviews: {//estructura con el array de reviews. por ahora tiene el id del save y un string que usaremos como valoracion
        type: [
            {
                saveID: { type: Number },
                rating: { type: Number }
            }
        ], default: []
    },
    notifications: { //notificaciones
        type: [
            {
                _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
                type: { type: Number },
                title: { type: String },
                body: { type: String },
                read: { type: Boolean, default: false },
                createdAt: { type: Date },
                link: { type: String }
            }
        ]

    }
});

// Añade el campo 'id' autoincremental
UserSchema.plugin(AutoIncrement, { inc_field: 'userID', start_seq: 0 });

UserSchema.statics.findByIdentifier = async function (identifier) {
    const normalized = identifier.toLowerCase();
    const encryptedMail = encrypt(normalized);

    return await this.findOne({
        $or: [
            { mail: encryptedMail },
            { userName: normalized }
        ]
    });
};

// comportamientos antes de guardar
UserSchema.pre('save', async function (next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10); //salt = valor aleatorio
            this.password = await bcrypt.hash(this.password, salt); //hashea la contraseña
        }
        if (this.isModified('mail')) {
            const normalizedMail = this.mail.toLowerCase();
            this.mail = encrypt(normalizedMail);
        }
        if (this.isModified('bio')) {
            const MAX_LINES = 5;
            const MAX_BIO_LENGTH = 500;

            const bioLines = this.bio.split('\n');
            if (bioLines.length > MAX_LINES) {
                throw new Error(`Bio must have no more than ${MAX_LINES} lines`);
            }
            if (this.bio.length > MAX_BIO_LENGTH) {
                throw new Error(`Bio must be shorter than ${MAX_BIO_LENGTH} characters`);
            }

            this.bio = bioLines.map(line => line.trim()).join('\n').trim();
        }
        if (this.isModified("userName")) {
            const original = this.userName;
            this.userName = this.userName.toLowerCase();

            if (this.userName.length > 25) {
                const err = new Error("El nombre de usuario no puede tener más de 15 caracteres.");
                return next(err);
            }

            const valid = /^[a-z0-9_]+$/.test(this.userName);
            if (!valid) {
                const err = new Error("El nombre de usuario solo puede contener letras minúsculas, números y guiones bajos.");
                return next(err);
            }

            if (original !== this.userName) {
                console.log(`Normalizado userName: ${original} -> ${this.userName}`);
            }
        }

        next();
    } catch (err) {
        next(err);
    }

});


const Users = mongoose.models.Users || mongoose.model('Users', UserSchema);
module.exports = { Users };