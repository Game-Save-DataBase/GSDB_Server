const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const ApiKey = require('../../models/ApiKeys');
const {Users} = require('../../models/Users');
const allowedOriginsMW = require('../../middleware/allowedOriginsMW');
const { authenticateMW, authenticateAdminMW } = require('../../middleware/authMW');
const mongoose = require('mongoose');
// Crear nueva API key para un usuario existente
router.post('/create', allowedOriginsMW, authenticateMW, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'user objectId required' });

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }
  const user = await Users.findOne({ _id: userId });  if (!user) return res.status(404).json({ error: 'User not found' });

  const key = crypto.randomBytes(32).toString('hex');
  const newKey = new ApiKey({ key, user: user._id, active: true });
  await newKey.save();

  res.json({ apiKey: key, userId: user._id });
});

// Listar API keys de un usuario
router.get('/list/:userId', allowedOriginsMW, async (req, res) => {
  try {
    const keys = await ApiKey.find({ user: req.params.userId })
      .populate('user', '_id userID userName') // trae _id, userID y userName del usuario
      .select('key _id'); // _id de la API key y key

    const formattedKeys = keys.map(k => ({
      apiKeyId: k._id,       
      key: k.key,
      userObjectId: k.user._id,  
      userID: k.user.userID,     
      userName: k.user.userName
    }));

    res.json(formattedKeys);
  } catch (err) {
    console.error('Error listando API keys:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revocar API key
router.post('/revoke', authenticateAdminMW, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });

  const apiKey = await ApiKey.findOne({ key });
  if (!apiKey) return res.status(404).json({ error: 'API key not found' });

  apiKey.active = false;
  await apiKey.save();

  res.json({ msg: 'API key revoked' });
});

module.exports = router;
