
let igdbPlatformIds = [];

function setIgdbPlatformIds(newIds) {
  igdbPlatformIds = newIds;
}
function getIgdbPlatformIds() {
  return igdbPlatformIds;
}

module.exports = {
  setIgdbPlatformIds,
  getIgdbPlatformIds,
};
