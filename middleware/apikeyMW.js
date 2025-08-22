// middleware/apikeyMW.js
const ApiKey = require('../models/ApiKeys');
const { Users } = require('../models/Users');
const mongoose = require('mongoose');

module.exports = async function apiKeyMiddleware(req, res, next) {
    if (process.env.DEV_MODE === 'true') { return next(); }

    const origin = req.get('origin');
    const isProduction = process.env.NODE_ENV === 'production';
    const origins = isProduction
        ? process.env.PROD_ORIGINS?.split(',').map(o => o.trim()) || []
        : process.env.DEV_ORIGINS?.split(',').map(o => o.trim()) || [];

    // Si la solicitud viene de un origen permitido, no se pide API key
    if (origins.includes(origin)) return next();
    // Soporte para llamadas internas con token
    if (req.headers['x-internal-token'] === process.env.INTERNAL_MW_KEY) return next();

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing API key' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid API key format' });

    try {
        const apiKey = await ApiKey.findOne({ key: token, active: true }).populate('user');
        if (!apiKey) return res.status(401).json({ error: 'Invalid API key' });

        req.apiUser = apiKey.user;
        next();
    } catch (err) {
        console.error('Error verificando API key:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
