const { apiRequest } = require('./apiClient');

const BASE_URL = 'https://opencritic-api.p.rapidapi.com/';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function callOpenCritic(endpoint, params = {}, res = null) {
  return apiRequest({
    url: BASE_URL + endpoint,
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'opencritic-api.p.rapidapi.com',
    },
    params,
    res,
  });
}

module.exports = { callOpenCritic };
