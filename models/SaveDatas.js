// models/SaveDatas.js

/**
 * ESQUEMA PARA DATOS DE GUARDADO.
 * */

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const config = require('../utils/config');
const fs = require('fs/promises');
const path = require('path');
const uploadsBasePath = path.join(__dirname, '..', config.paths.uploads);
const { Comments } = require('./Comments');

const SavesSchema = new mongoose.Schema({
  userID: { type: Number, required: true },       //id del usuario registrado que ha realizado la subida
  gameID: { type: Number, required: true },       //ID al juego en nuestra base de datos
  platformID: { type: Number, required: true },   //ID a una plataforma en nuestra base de datos 
  file: { type: String, default: "" },   //nombre del archivo en el servidor
  fileSize: { type: Number, default: 0 },   //tamaño en bytes
  private: { type: Boolean, default: false },    //indica si es un archivo que no se verá por el resto de usuarios
  title: { type: String, required: true, default: "Archivo de guardado" }, //nombre del archivo que se mostrará
  description: { type: String, default: "" },    //descripcion del archivo
  postedDate: { type: Date, default: Date.now },    // to do: meter un last update date
  nDownloads: { type: Number, default: 0 },
  likes: { type: [Number], default: [] }, //array de userID unicos
  dislikes: { type: [Number], default: [] }, //array de userID unicos
  rating: { type: Number, default: 0 }, //valor ponderado calculado a traves de los likes y dislikes
  tagID: { type: [String], required: false } // ids de las tag asociadas a este save
});
SavesSchema.plugin(AutoIncrement, { inc_field: 'saveID', start_seq: 0 });

let saveToDelete = null;
SavesSchema.pre('deleteOne', { document: false, query: true }, async function (next) {
  try {
    saveToDelete = await this.model.findOne(this.getFilter(), 'saveID').lean();
  } catch (err) {
    console.error('Error fetching save in pre deleteOne:', err);
    saveToDelete = null;
  }
  next();
});

SavesSchema.post('deleteOne', { document: false, query: true }, async function () {
  if (!saveToDelete) return;

  const saveDir = path.join(uploadsBasePath, String(saveToDelete.saveID));

  try {
    await fs.rm(saveDir, { recursive: true, force: true });

    const { Users } = require('./Users');
    // Restar likes y dislikes al dueño del save
    const user = await Users.findOne({ userID: saveToDelete.userID });
    if (user) {
      console.log("borrando likes y dislikes")
      user.nLikes -= saveToDelete.likes.length;
      user.nDislikes -= saveToDelete.dislikes.length;
      if (user.nLikes < 0) user.nLikes = 0;
      if (user.nDislikes < 0) user.nDislikes = 0;
      await user.save(); // recalcula rating
    }

    await Users.updateMany(
      { $or: [{ likes: saveToDelete.saveID }, { dislikes: saveToDelete.saveID }] },
      {
        $pull: {
          likes: saveToDelete.saveID,
          dislikes: saveToDelete.saveID,
          uploads: saveToDelete.saveID,
          favSaves: saveToDelete.saveID,
          downloadHistory: { $in: saveIDsToDelete }
        }
      }
    );
    await Comments.deleteMany({ saveID: saveToDelete.saveID });
  } catch (err) {
    console.error(`Error deleting data for saveID ${saveToDelete.saveID}:`, err);
  } finally {
    saveToDelete = null;
  }
});


let saveIDsToDelete = [];

SavesSchema.pre('deleteMany', async function (next) {
  try {
    const docsToDelete = await this.model.find(this.getFilter(), 'saveID').lean();
    saveIDsToDelete = docsToDelete.map(doc => doc.saveID);
    // Guardamos también para ajuste de contadores
    this._savesDataToAdjust = docsToDelete;
  } catch (err) {
    console.error('Error capturando saveIDs en pre deleteMany:', err);
    saveIDsToDelete = [];
    this._savesDataToAdjust = [];
  }
  next();
});

SavesSchema.post('deleteMany', async function () {
  try {
    const folders = await fs.readdir(uploadsBasePath, { withFileTypes: true });

    const deletions = folders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => fs.rm(path.join(uploadsBasePath, dirent.name), { recursive: true, force: true }));

    await Promise.all(deletions);

    if (saveIDsToDelete.length > 0) {
      const { Users } = require('./Users');

      // Ajustar contadores de cada usuario propietario
      for (const save of this._savesDataToAdjust) {
        const user = await Users.findOne({ userID: save.userID });
        if (user) {
          console.log("borrando likes y dislikes")
          user.nLikes -= save.likes.length;
          user.nDislikes -= save.dislikes.length;
          if (user.nLikes < 0) user.nLikes = 0;
          if (user.nDislikes < 0) user.nDislikes = 0;
          await user.save();
        }
      }

      await Users.updateMany(
        { $or: [{ likes: { $in: saveIDsToDelete } }, { dislikes: { $in: saveIDsToDelete } }] },
        {
          $pull: {
            likes: { $in: saveIDsToDelete },
            dislikes: { $in: saveIDsToDelete },
            uploads: { $in: saveIDsToDelete },
            favSaves: { $in: saveIDsToDelete },
            downloadHistory: { $in: saveIDsToDelete }
          }
        }
      );

      await Comments.deleteMany({ saveID: { $in: saveIDsToDelete } });
    }
  } catch (fsErr) {
    console.error('error wiping savefile data:', fsErr);
  }
});

let prevLikes = [];
let prevDislikes = [];

// Pre-save: guardar arrays anteriores
SavesSchema.pre('save', async function (next) {
  if (!this.isModified('likes') && !this.isModified('dislikes')) {
    return next();
  }

  try {
    if (!this.isNew) {
      const existing = await this.constructor.findById(this._id).lean();
      prevLikes = existing?.likes || [];
      prevDislikes = existing?.dislikes || [];
    } else {
      prevLikes = [];
      prevDislikes = [];
    }
  } catch (err) {
    console.error('Error fetching previous likes/dislikes:', err);
  }

  next();
});
SavesSchema.post('save', async function (doc, next) {
  const { Users } = require('./Users');

  const likesChanged =
    prevLikes.length !== doc.likes.length ||
    !prevLikes.every(id => doc.likes.includes(id));

  const dislikesChanged =
    prevDislikes.length !== doc.dislikes.length ||
    !prevDislikes.every(id => doc.dislikes.includes(id));

  if (likesChanged || dislikesChanged) {
    try {
      const user = await Users.findOne({ userID: doc.userID });

      if (likesChanged) {
        const diff = doc.likes.length - prevLikes.length;
        user.nLikes += diff;
      }
      if (dislikesChanged) {
        const diff = doc.dislikes.length - prevDislikes.length;
        user.nDislikes += diff;
      }

      await user.save(); // aquí se recalcula el rating del usuario
    } catch (err) {
      console.error('Error actualizando likes/dislikes en usuario:', err);
    }
  }

  next();
});



const SaveDatas = mongoose.models.SaveDatas || mongoose.model('savedatas', SavesSchema);

module.exports = { SaveDatas };