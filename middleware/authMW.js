const httpResponses = require('../utils/httpResponses');

// Middleware para autenticar obligatoriamente
function authenticateMW(req, res, next) {
  if (req.isAuthenticated() || process.env.DEV_MODE === 'true') {
    return next();
  }
  return httpResponses.unauthorized(res, 'Not authorized, you must be logged in.');
}

// Middleware para comprobar si hay usuario logueado (sin error)
function checkLoggedUserMW(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    req.loggedUser = req.user; // Guarda el usuario en req.loggedUser
  } else {
    req.loggedUser = null;
  }
  next();
}

module.exports = {
  authenticateMW,
  checkLoggedUserMW
};