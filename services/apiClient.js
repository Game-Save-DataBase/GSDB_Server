const axios = require('axios');
const httpResponses = require('../utils/httpResponses');

async function apiRequest({ url, method = 'GET', headers = {}, params = {}, data = null, res = null }) {
  try {
    const response = await axios({
      url,
      method,
      headers,
      params,
      data,
    });

    return response.data;
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message || 'API call failed';
    const { handler, code } = httpResponses.mapStatusToHttpError(status, message);

    if (res) {
      return handler(res, message);
    }

    throw {
      code,
      error: handler.name.toUpperCase(),
      message,
    };
  }
}

module.exports = { apiRequest };
