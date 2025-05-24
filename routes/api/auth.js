const express = require('express');
const passport = require('passport');
const { Users: User } = require('../../models/Users');
const zxcvbn = require('zxcvbn');
const httpResponses = require('../../utils/httpResponses');

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  if (req.isAuthenticated()) {
    return httpResponses.badRequest(res, 'Ya estás autenticado, cierra sesión');
  }

  const { userName, mail, password } = req.body;
  const cleanMail = mail.trim().toLowerCase();
  const cleanUserName = userName.trim().toLowerCase();

  const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!mailRegex.test(cleanMail)) {
    return httpResponses.badRequest(res, 'Correo electrónico inválido');
  }

  const userNameRegex = /^[a-z0-9_]{4,25}$/;
  if (!userNameRegex.test(cleanUserName)) {
    return httpResponses.badRequest(
      res,
      'El nombre de usuario debe estar en minúsculas, tener entre 4 y 25 caracteres, y contener solo letras, números o guiones bajos'
    );
  }

  const passwordStrength = zxcvbn(password);
  if (passwordStrength.score < 3) {
    return httpResponses.badRequest(res, 'La contraseña es demasiado débil.', {
      warning: passwordStrength.feedback.warning,
      suggestions: passwordStrength.feedback.suggestions,
    });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ mail: cleanMail }, { userName: cleanUserName }],
    });
    if (existingUser) {
      return httpResponses.badRequest(res, 'El usuario o correo electrónico ya están en uso');
    }

    const user = new User({ userName: cleanUserName, mail: cleanMail, password });
    await user.save();

    return httpResponses.created(res, 'Usuario registrado exitosamente');
  } catch (err) {
    if (err.code === 11000) {
      if (err.message.includes('userName')) {
        return httpResponses.badRequest(res, 'El nombre de usuario ya está en uso.');
      }
      if (err.message.includes('mail')) {
        return httpResponses.badRequest(res, 'El correo electrónico ya está en uso.');
      }
    }
    return httpResponses.internalError(res, 'Error en el servidor', err.message);
  }
});

// Login de usuario
router.post('/login', (req, res, next) => {
  if (req.isAuthenticated()) {
    return httpResponses.badRequest(res, 'Ya estás autenticado, cierra sesión para cambiar de usuario.');
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return httpResponses.badRequest(res, info.message);

    req.logIn(user, err => {
      if (err) return next(err);
      return httpResponses.ok(res, { msg: 'Inicio de sesión exitoso', user });
    });
  })(req, res, next);
});

// Logout de usuario
router.get('/logout', (req, res) => {
  if (!req.isAuthenticated()) {
    return httpResponses.unauthorized(res, 'No hay sesión iniciada.');
  }
  req.logout(err => {
    if (err) return httpResponses.internalError(res, 'Error al cerrar sesión', err.message);
    req.session.destroy(() => {
      res.clearCookie('connect.sid'); // cookie default express
      return httpResponses.ok(res, 'Sesión cerrada correctamente');
    });
  });
});

// Verificar si el usuario está autenticado
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    return httpResponses.ok(res, { user: req.user });
  }
  return httpResponses.unauthorized(res, 'Sesión no iniciada');
});

module.exports = router;
