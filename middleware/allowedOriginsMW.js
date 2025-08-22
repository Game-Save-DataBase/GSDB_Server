const origins = (process.env.NODE_ENV === 'production') ?
  process.env.PROD_ORIGINS?.split(',').map(o => o.trim()) || [] : process.env.DEV_ORIGINS?.split(',').map(o => o.trim()) || [];

module.exports = function allowedOriginsMW(req, res, next) {
  const origin = req.get('origin');
  if (!origin || !origins.includes(origin)) {
    return res.status(403).json({ error: 'Not allowed origin' });
  }
  next();
};
