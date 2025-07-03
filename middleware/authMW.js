const httpResponses = require('../utils/httpResponses');

// Middleware para autenticar
module.exports = function authenticateMW(req, res, next) {
  if (req.isAuthenticated() || process.env.DEV_MODE === 'true') {
    return next();
  }
  return httpResponses.unauthorized(res, 'Not authorized, you must be logged in.');
};

