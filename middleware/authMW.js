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
function authenticateAdminMW(req, res, next) {
  // Comprueba que el usuario está logueado
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return httpResponses.unauthorized(res, 'Not authorized, you must be logged in.');
  }

  // Comprueba que el usuario tiene admin = true
  if (!req.user || req.user.admin !== true) {
    return httpResponses.forbidden(res, 'Forbidden: Admin access required.');
  }

  // Usuario autenticado y admin
  req.loggedUser = req.user; // opcional, igual que en checkLoggedUserMW
  next();
}

module.exports = {
  authenticateMW,
  checkLoggedUserMW,
  authenticateAdminMW
};