const httpResponses = require('../utils/httpResponses');

// Middleware para autenticar obligatoriamente
function authenticateMW(req, res, next) {
  try {
    console.log("REQ.ISAUTH de la funcion authenticateMW:")
    console.log(req.isAuthenticated())
    if (req.isAuthenticated() || process.env.DEV_MODE === 'true') {
      return next();
    }
    return httpResponses.unauthorized(res, 'Not authorized, you must be logged in.');

  } catch (err) {
    console.error(err)
  }
}

// Middleware para comprobar si hay usuario logueado (sin error)
function checkLoggedUserMW(req, res, next) {
  try {
    console.log("REQ.ISAUTH de la funcion checkloggedusermw:")
    console.log(req.isAuthenticated())

    if (req.isAuthenticated && req.isAuthenticated()) {
      req.loggedUser = req.user; // Guarda el usuario en req.loggedUser
    } else {
      req.loggedUser = null;
    }

  } catch (err) {
    console.error(err)
  }
  next();
}

module.exports = {
  authenticateMW,
  checkLoggedUserMW
};