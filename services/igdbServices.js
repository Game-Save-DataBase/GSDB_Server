const { apiRequest } = require('./apiClient');
const IGDB_BASE_URL = 'https://api.igdb.com/v4/';

let accessToken = null;
let expiresAt = 0;

async function getAccessToken() {
  const now = Date.now();

  if (accessToken && now < expiresAt) {
    return accessToken;
  }

  const response = await apiRequest({
    url: 'https://id.twitch.tv/oauth2/token',
    method: 'POST',
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });

  accessToken = response.access_token;
  expiresAt = now + response.expires_in * 1000 - 60 * 1000;
  console.log(accessToken)

  return accessToken;
}


async function callIGDB(endpoint, query, res = null) {
  const token = await getAccessToken();

  try {
    return await apiRequest({
      url: IGDB_BASE_URL + endpoint,
      method: 'POST',
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
      data: query,
    });
  } catch (err) {
    const status = err?.response?.status;
    const detail = err?.response?.data;

    console.error('[IGDB API ERROR]', status, detail || err.message);

    if (res && status) {
      const { handler } = httpResponses.mapStatusToHttpError(status);
      return handler(res, Array.isArray(detail) ? detail[0]?.cause || detail[0]?.title : detail?.message || 'IGDB API Error');
    }

    // Lanzamos un error enriquecido con status y mensaje para capturarlo en el endpoint
    const enrichedError = new Error(
      Array.isArray(detail) ? detail[0]?.cause || detail[0]?.title : detail?.message || err.message
    );
    enrichedError.status = status || 500;
    throw enrichedError;
  }
}


module.exports = { callIGDB };
