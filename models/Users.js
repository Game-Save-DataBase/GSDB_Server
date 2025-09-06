// models/Users.js

/**
 * ESQUEMA PARA USUARIOS
 * Contrendra la informacion de cada usuario registrado
 * */
const config = require('../utils/config');
const fs = require('fs/promises');
const path = require('path');

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const bcrypt = require('bcryptjs'); //usamos bcryptjs en lugar de bcrypt porque bcryptjs no tiene dependencias de c++, es todo js.
const { encrypt, decrypt } = require('../utils/encrypt.js');
const userAssetsBasePath = (process.env.NODE_ENV === 'production') ?  config.paths.userProfiles : path.join(__dirname, '..', config.paths.userProfiles);
const { sendNotification } = require('../scripts/sendNotification');

const UserSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true },     //nombre del usuario
  alias: { type: String, default: "" },           //nombre de usuario con el que quiere que se le identifique publicamente
  mail: { type: String, required: true, unique: true },         //indica si es un administrador de la pagina
  password: { type: String, required: true },  //estara encriptada
  admin: { type: Boolean, default: false },       //indica si es un usuario con privilegios
  verified: { type: Boolean, default: false },    //indica si es un usuario verificado
  trusted: { type: Boolean, default: false },    //indica si es un confiable (buen rating)
  banned: { type: Boolean, default: false },    //bloqueos permanentes
  softban: { type: Boolean, default: false },    //bloqueos no permanentes o penalizaciones
  favGames: { type: [Number], default: [] },    //lista de juegos marcados como favoritos
  favSaves: { type: [Number], default: [] },    //lista de juegos marcados como favoritos
  following: { type: [Number], default: [] },   //lista de usuarios a los que sigue
  followers: { type: [Number], default: [] },   //lista de usuarios que le siguen
  uploads: { type: [Number], default: [] },       //lista de archivos subidos por este usuario
  bio: { type: String, default: "" },                  //biografia/descripcion del usuario
  downloadHistory: { type: [Number], default: [] },  //historial de descargas del usuario
  likes: { type: [Number], default: [] }, //array de saveID unicos
  dislikes: { type: [Number], default: [] }, //array de saveID unicos
  nLikes: { type: Number, default: 0 },     // total acumulado de likes recibidos en todos sus saves
  nDislikes: { type: Number, default: 0 },  // total acumulado de dislikes recibidos en todos sus saves
  rating: { type: Number, default: 0 },     // rating ponderado del usuario
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

//para el calculo del rating
function wilsonScore(likesCount, dislikesCount, z = 1.96) {
  const n = likesCount + dislikesCount;
  if (n === 0) return 0;
  const p = likesCount / n;
  const denominator = 1 + (z ** 2) / n;
  const centre = p + (z ** 2) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n);
  const lowerBound = (centre - margin) / denominator;
  return lowerBound * 100;
}


let previousFollowers = null;
let createFolder = false;
// comportamientos antes de guardar
UserSchema.pre('save', async function (next) {
  try {
    // Si es nuevo, solo crear la carpeta
    createFolder = this.isNew

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

    } if (this.isModified('admin')){
      this.verified = true; this.banned = false; this.softban = false; this.trusted=true;
    }
    if (this.isModified('verified')){
      this.trusted = (this.rating >= 80 && !this.banned && !this.softban) || (this.verified);
    }
     if (this.isModified('nLikes') || this.isModified('nDislikes')) {
      this.rating = wilsonScore(this.nLikes, this.nDislikes);
      this.trusted = (this.rating >= 80 && !this.banned && !this.softban) || this.verified;
    } if (this.isModified('followers')) {
      try {
        const previous = await this.constructor.findById(this._id).lean();
        previousFollowers = previous?.followers || [];
      } catch (err) {
        console.error('Error in pre-save getting previous followers:', err);
        previousFollowers = [];
      }
    } else {
      previousFollowers = null;
    }

    next();
  } catch (err) {
    next(err);
  }

});

UserSchema.post('save', async function (doc, next) {
  try {
    if (createFolder) {
      const userDir = path.join(userAssetsBasePath, String(doc.userID));
      try {
        await fs.access(userDir);
      } catch {
        try {
          await fs.mkdir(userDir, { recursive: true });
        } catch (err) {
          console.error(`Error creating folder for userID ${doc.userID}:`, err);
        }
      }
    }


    // No hay cambios en followers, no hacer nada
    if (!previousFollowers) return next();

    const currentFollowers = doc.followers || [];
    const newFollowers = currentFollowers.filter(id => !previousFollowers.includes(id));

    if (newFollowers.length === 0) return next();

    for (const followerID of newFollowers) {
      const followerUser = await this.constructor.findOne({ userID: followerID }).lean();
      if (!followerUser) continue;

      await sendNotification({
        userIDs: [doc.userID],
        type: 1,
        args: { followerUser }
      });
    }

    next();
  } catch (err) {
    console.error('Error in Users post-save hook:', err);
    next(err);
  }
});


let deletedUsers = [];
let userToDelete = null;

UserSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
  try {
    userToDelete = await this.model.findOne(this.getFilter(), 'userID').lean();
  } catch (err) {
    console.error('Error in pre deleteOne:', err);
    userToDelete = null;
  }
  next();
});

UserSchema.pre('deleteMany', async function (next) {
  try {
    deletedUsers = await this.model.find(this.getFilter(), 'userID').lean();
  } catch (err) {
    console.error('Error in pre deleteMany:', err);
    deletedUsers = [];
  }
  next();
});

UserSchema.post('deleteOne', { document: false, query: true }, async function () {
  if (!userToDelete) return;

  const userDir = path.join(userAssetsBasePath, String(userToDelete.userID));

  try {
    await fs.rm(userDir, { recursive: true, force: true });

    const { SaveDatas } = require('./SaveDatas');

    await SaveDatas.updateMany(
      { $or: [{ likes: userToDelete.userID }, { dislikes: userToDelete.userID }] },
      {
        $pull: {
          likes: userToDelete.userID,
          dislikes: userToDelete.userID
        }
      }
    );

    const { Games } = require('./Games');
    await Games.updateMany(
      { $or: [{ userFav: userToDelete.userID }] },
      {
        $pull: {
          userFav: userToDelete.userID
        }
      }
    );

    await this.model.updateMany(
      {
        $or: [
          { followers: userToDelete.userID },
          { following: userToDelete.userID }
        ]
      },
      {
        $pull: {
          followers: userToDelete.userID,
          following: userToDelete.userID
        }
      }
    );

  } catch (err) {
    console.error(`Error deleting data for userID ${userToDelete.userID}:`, err);
  } finally {
    userToDelete = null;
  }
});

UserSchema.post('deleteMany', async function () {
  try {
    const folders = await fs.readdir(userAssetsBasePath, { withFileTypes: true });

    const deletions = folders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => fs.rm(path.join(userAssetsBasePath, dirent.name), { recursive: true, force: true }));

    await Promise.all(deletions);

    const userIDs = deletedUsers.map(u => u.userID);
    if (userIDs.length > 0) {
      const { SaveDatas } = require('./SaveDatas');

      await SaveDatas.updateMany(
        {
          $or: [
            { likes: { $in: userIDs } },
            { dislikes: { $in: userIDs } }
          ]
        },
        {
          $pull: {
            likes: { $in: userIDs },
            dislikes: { $in: userIDs }
          }
        }
      );

      const { Games } = require('./Games');
      await Games.updateMany(
        {
          $or: [
            { userFav: { $in: userIDs } }
          ]
        },
        {
          $pull: {
            userFav: { $in: userIDs }
          }
        }
      );

      await this.model.updateMany(
        {
          $or: [
            { followers: { $in: userIDs } },
            { following: { $in: userIDs } }
          ]
        },
        {
          $pull: {
            followers: { $in: userIDs },
            following: { $in: userIDs }
          }
        }
      );
    }
  } catch (fsErr) {
    console.error('Error wiping user data:', fsErr);
  } finally {
    deletedUsers = [];
  }
});



const Users = mongoose.models.Users || mongoose.model('Users', UserSchema);
module.exports = { Users };