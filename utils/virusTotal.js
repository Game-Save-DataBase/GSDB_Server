const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('./config');

async function scanFileWithVirusTotal(filePath) {
    const fileBuffer = fs.readFileSync(filePath);

    const form = new FormData();
    form.append('file', fileBuffer, 'upload.zip');

    const uploadResponse = await axios.post(config.virusTotal.scanUrl, form, {
        headers: {
            ...form.getHeaders(),
            'x-apikey': config.virusTotal.apiKey,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000,
    });

    const analysisId = uploadResponse.data.data.id;

    // Polling para esperar resultados del análisis
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // espera 3 segundos

        const analysisResponse = await axios.get(`${config.virusTotal.reportUrl}${analysisId}`, {
            headers: {
                'x-apikey': config.virusTotal.apiKey
            },
        });

        const status = analysisResponse.data.data.attributes.status;

        if (status === 'completed') {
            return analysisResponse.data;
        }
    }

    throw new Error('VirusTotal scan timed out');
}


function isFileMalicious(vtReport) {
    const stats = vtReport.data?.attributes?.stats;
    if (!stats) return false;
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;

    return malicious > 0 || suspicious > 0;
}

module.exports = {
    scanFileWithVirusTotal,
    isFileMalicious,
};
