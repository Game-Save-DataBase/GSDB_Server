const httpResponses = require('../utils/httpResponses');

// Middleware para bloquear si NO está en modo dev
module.exports = function blockIfNotDev(req, res, next) {
  if (process.env.DEV_MODE !== 'true') {
    return httpResponses.forbidden(res, 'Operation not allowed outside development mode');
  }
  return next();
};
