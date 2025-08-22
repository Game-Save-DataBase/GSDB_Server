const axios = require('axios');
const config = require('../utils/config');

async function refreshIGDB() {
  console.log(' ----Refrescando datos de IGDB...---');
  try {
    const response = await axios.post(
      `${config.connection}${config.api.platforms}/refresh-igdb`,
      {},
      {
        headers: {
          'X-Internal-Token': process.env.INTERNAL_MW_KEY
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error refreshing IGDB:', error.message || error);
    throw error;
  } finally {
    console.log(`----Finalizado refresco de datos de IGDB----`);

  }


}

module.exports = { refreshIGDB };
