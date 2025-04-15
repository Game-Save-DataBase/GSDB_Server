
//middleware para autenticar
module.exports = function authenticateMW(req, res, next) {
    if (req.isAuthenticated() || process.env.DEV_MODE === 'true') {
        return next();
    }
    res.status(401).json({ msg: 'No autorizado, inicia sesión' });
};
