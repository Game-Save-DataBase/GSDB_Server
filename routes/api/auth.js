const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../../models/Users');
const zxcvbn = require('zxcvbn'); //libreria para la seguridad de las contraseñas

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
    const { userName, mail, password } = req.body;
    //antes que nada usamos expresiones regulares para los valores introducidos
    
    const cleanMail = mail.trim().toLowerCase();

    const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!mailRegex.test(cleanMail)) {
        return res.status(400).json({ msg: 'Correo electrónico inválido' });
    }
    const userNameRegex = /^[a-zA-Z0-9_]{4,25}$/;
    if (!userNameRegex.test(userName)) {
        return res.status(400).json({ msg: 'El nombre de usuario debe tener entre 4 y 25 caracteres, y contener solo letras, números o guiones bajos' });
    }
    // con la libreria zxcvbn comprobamos la seguridad de la password
    const passwordStrength = zxcvbn(password);
    if (passwordStrength.score < 3) {
        return res.status(400).json({
            msg: 'La contraseña es demasiado débil.',
            warning: passwordStrength.feedback.warning,
            suggestions: passwordStrength.feedback.suggestions
        });
    }

    try {
        let user = await User.findOne({ $or: [{ cleanMail }, { userName }] });
        if (user) return res.status(400).json({ msg: 'El usuario o correo electrónico ya están en uso' });

        user = new User({ userName, mail: cleanMail, password: password });
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
        req.session.destroy(() => {
            res.clearCookie('connect.sid'); //nombre por defecto de la cookie de express
            res.json({ msg: 'Sesión cerrada correctamente' });
        })

    });
});

// Verificar si el usuario está autenticado
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(500).json({ msg: 'Sesion no iniciada' });
    }
});

module.exports = router;
