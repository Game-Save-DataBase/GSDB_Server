const axios = require('axios');
const httpResponses = require('../utils/httpResponses');

let accessToken = null;
let expiresAt = 0; // timestamp devuelto por igdb
const IGDB_BASE_URL = 'https://api.igdb.com/v4/';

async function getAccessToken() {
  const now = Date.now();

  if (accessToken && now < expiresAt) {
    return accessToken;
  }

  console.log('[IGDB] Generando nuevo access_token...');

  const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });

  accessToken = response.data.access_token;
  // convertimos de seg a ms
  expiresAt = now + response.data.expires_in * 1000 - 60 * 1000; // Le restamos 1 minuto por seguridad

  console.log(`[IGDB] Nuevo token obtenido: ${accessToken}, expira en`, new Date(expiresAt).toLocaleString());

  return accessToken;
}

async function callIGDB(endpoint, query) {
  const token = await getAccessToken();

  try {
    const response = await axios.post(
      IGDB_BASE_URL + endpoint,
      query,
      {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data || err.message;

    const enriched = {
      code: status || 500,
      message: data?.message || 'IGDB call failed',
    };

    throw enriched;
  }
}

module.exports = { getAccessToken, callIGDB };
