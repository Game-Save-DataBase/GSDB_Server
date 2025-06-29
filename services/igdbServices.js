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

  return apiRequest({
    url: IGDB_BASE_URL + endpoint,
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    data: query,
    res,
  });
}

module.exports = { callIGDB };
