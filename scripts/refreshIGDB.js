const axios = require('axios');
const config = require('../utils/config');

async function refreshIGDB() {
  try {
    const response = await axios.post(`${config.connection}${config.api.platforms}/refresh-igdb`);
    return response.data;
  } catch (error) {
    console.error('Error refreshing IGDB:', error.message || error);
    throw error;
  }
}

module.exports = { refreshIGDB };
