// utils/devModeMW.js
module.exports = function blockIfNotDev(req, res, next) {
    if (process.env.DEV_MODE !== 'true') {
        return res.status(403).json({ error: 'Operation not allowed outside development mode' });
    }
    next();
};