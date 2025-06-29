const axios = require('axios');
const cheerio = require('cheerio');

const BASE_API = 'https://www.pcgamingwiki.com/w/api.php';

const platformKeywords = [
  { keyword: 'steam play (linux)', id: 6, displayName: 'Steam Play (Linux)' },
  { keyword: 'windows', id: 6, displayName: 'Windows' },
  { keyword: 'pc', id: 6, displayName: 'PC' },
  { keyword: 'mac', id: 14, displayName: 'Mac' },
  { keyword: 'os x', id: 14, displayName: 'Mac' },
  { keyword: 'linux', id: 3, displayName: 'Linux' },
  { keyword: 'dos', id: 13, displayName: 'DOS' },
];

function mapSystemToPlatform(systemName) {
  if (!systemName) return null;
  const lowerSystem = systemName.toLowerCase();

  for (const { keyword, id, displayName } of platformKeywords) {
    if (lowerSystem.includes(keyword)) {
      return { platformID: id, platformName: displayName || systemName };
    }
  }
  return null;
}

async function searchBestMatch(gameName) {
  const response = await axios.get(BASE_API, {
    params: {
      action: 'opensearch',
      search: gameName,
      format: 'json',
      limit: 5,
      namespace: 0,
    },
  });

  const [, titles, , urls] = response.data;

  if (!titles.length || !urls.length) {
    return null;
  }
  const pageTitle = decodeURIComponent(new URL(urls[0]).pathname.replace('/wiki/', ''));
  return pageTitle;
}

async function fetchPageHtml(pageTitle) {
  const response = await axios.get(BASE_API, {
    params: {
      action: 'parse',
      page: pageTitle,
      prop: 'text',
      format: 'json',
    },
  });
  return response.data?.parse?.text?.['*'] ?? null;
}

function extractSaveLocations(html) {
  const $ = cheerio.load(html);

  const section = $('#Save_game_data_location');
  if (!section.length) return [];

  const table = section.closest('h3').nextAll('div.container-pcgwikitable').first().find('table');
  if (!table.length) return [];

  const result = [];

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const system = $row.find('th').text().trim();
    const locationTd = $row.find('td');

    if (!system || !locationTd.length) return;

    const platformInfo = mapSystemToPlatform(system);
    if (!platformInfo) return;

    const locations = [];
    locationTd.html().split(/<br\s*\/?>/i).forEach((fragment) => {
      let clean = cheerio.load(fragment).text().trim();
      clean = clean.replace(/\[.*?\]/g, '').trim();
      if (clean) locations.push(clean);
    });

    if (locations.length > 0) {
      result.push({
        platform: platformInfo.platformID,
        platformName: platformInfo.platformName,
        locations,
      });
    }
  });

  return result;
}

async function getSaveFileLocations(gameName) {
  const page = await searchBestMatch(gameName);
  if (!page) return null;

  const html = await fetchPageHtml(page);
  if (!html) return null;

  const saveLocations = extractSaveLocations(html);
  const pcgwURL = `https://www.pcgamingwiki.com/wiki/${page}`;

  return {
    page,
    pcgwID: page,
    pcgwURL,
    saveLocations,
  };
}

module.exports = {
  getSaveFileLocations,
};
