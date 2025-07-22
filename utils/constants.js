let igdbPlatformMap = {};

function setIgdbPlatformMap(newMap) {
  igdbPlatformMap = newMap;
}

function getIgdbPlatformIds() {
  // Devuelve solo los IGDB_IDs (únicos)
  return Array.from(new Set(Object.values(igdbPlatformMap)));
}

function getIgdbPlatformMap() {
  return igdbPlatformMap;
}

module.exports = {
  setIgdbPlatformMap,
  getIgdbPlatformIds,
  getIgdbPlatformMap,
};
