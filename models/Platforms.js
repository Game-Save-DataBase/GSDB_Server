// models/Platforms.js

/**
 * ESQUEMA PARA PLATAFORMAS.
 * Este esquema es para identificar las plataformas donde se jugará con estos archivos de guardado.
 * No se trata de la plataforma de lanzamiento del juego, sino en donde se ejecutará el archivo de guardado.
 * Tendrá por lo tanto un nombre, una ruta de guardado default y su propio ID servirá a los demás esquemas para relacionarlo.
 * */

const mongoose = require('mongoose');

const PlatformSchema = new mongoose.Schema({
    name:{
        type: String,
        required:true
    },
    defaultPath:{
        type: String,
        default: "sin implementar"
    }

});

module.exports = Platforms = mongoose.model('platforms', PlatformSchema);