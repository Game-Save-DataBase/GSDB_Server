const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../../models/Users');

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
    const { userName, mail, password } = req.body;

    try {
        let user = await User.findOne({ $or: [{ mail }, { userName }] });
        if (user) return res.status(400).json({ msg: 'El usuario ya existe' });

        user = new User({ userName, mail, password: password });
        await user.save();

        res.status(201).json({ msg: 'Usuario registrado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login de usuario
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(400).json({ msg: info.message });

        req.logIn(user, err => {
            if (err) return next(err);
            res.json({ msg: 'Inicio de sesión exitoso', user });
        });
    })(req, res, next);
});

// Logout de usuario
router.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ msg: 'Sesión cerrada correctamente' });
    });
});

// Verificar si el usuario está autenticado
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ msg: 'No autorizado' });
    }
});

module.exports = router;
