// models/Paths.js

/**
 * ESQUEMA PARA LAS RUTAS DE GUARDADO.
 * Cada juego puede estar en varias plataformas,
 * Cada plataforma tendrá una ruta de guardado,
 * Por lo tanto, con este esquema podemos identificar:
 * - A qué juego pertenece esta ruta
 * - A que plataforma pertenece esta ruta
 * - Cual es la ruta
 * Asi podemos tener guardadas rutas verificadas.
 * Las rutas se encuentran en otras BBDD, pero es posible que no haya esa informacion. por eso tambien la guardamos nosotros.
 * Ejemplo: hay mucha informacion de rutas de guardado para Windows, pero no para Switch, por ejemplo.*/

const mongoose = require('mongoose');

const PathsSchema = new mongoose.Schema({
    //ID al juego en nuestra base de datos
    gameID: {
        type: String,
        required: true
    },
    //ID a una plataforma en nuestra base de datos
    platformID:{
        type: String,
        required:true
    },
    path:{
        type: String,
        default: ""
    }

});

module.exports = Paths = mongoose.model('paths', PathsSchema);