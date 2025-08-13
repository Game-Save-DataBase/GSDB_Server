const httpResponses = require('../utils/httpResponses');

module.exports = function checkInternalToken(req, res, next) {
  const token = req.header('X-Internal-Token');
  if (token !== process.env.INTERNAL_MW_KEY) {
    return httpResponses.forbidden(res, 'Access denied: invalid internal token');
  }
  return next();
};
