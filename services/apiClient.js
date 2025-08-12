const axios = require('axios');
const httpResponses = require('../utils/httpResponses');

async function apiRequest({ url, method = 'GET', headers = {}, params = {}, data = null, res = null }) {
  try {
    console.log("LLAMANDO APIREQUEST")
    console.log(url, method, headers, params, data)
    const response = await axios({
      url,
      method,
      headers,
      params,
      data,
    });
    console.log("RESULTADO APIREQUEST:", response.data)
    return response.data;
  } catch (err) {
    console.log("ERROR APIREQUEST")
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message || 'API call failed';
    console.log("STATUS:", status)
    console.log("message:", message)
    const { handler, code } = httpResponses.mapStatusToHttpError(status, message);
    console.log("code:", code)
    console.log("ERROR COMPLETO:", err)

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
