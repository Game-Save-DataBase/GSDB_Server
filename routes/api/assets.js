const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const httpResponses = require('../../utils/httpResponses');
const config = require('../../utils/config');


const sendFileIfExists = (res, filePath, fileName) => {
  if (!fs.existsSync(filePath)) {
    return httpResponses.notFound(res, 'File not found');
  }
  return res.download(filePath, fileName);
};

const createZipAndSend = (res, folderPath, zipName = 'archive.zip') => {
  if (!fs.existsSync(folderPath)) {
    return httpResponses.notFound(res, 'Directory not found');
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment(zipName);
  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
};
// Utilidad para encontrar el primer archivo .zip en un directorio (asumimos que será el save)
const findFirstZip = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) return null;
  const files = fs.readdirSync(directoryPath);
  return files.find(file => path.extname(file).toLowerCase() === '.zip') || null;
};// Encuentra un archivo por nombre base sin importar la extensión
const findFileByBaseName = (folderPath, baseName) => {
  if (!fs.existsSync(folderPath)) return null;

  const files = fs.readdirSync(folderPath);
  return files.find(file => path.parse(file).name === baseName) || null;
};

const uploadsBasePath = path.join(__dirname, '..', '..', config.paths.uploads)
const userBasePath = path.join(__dirname, '..', '..', config.paths.userProfiles)
const defaultsBasePath = path.join(__dirname, '..', '..', config.paths.defaults)

// 2. Savefile main file
router.get('/savefile/:id/file', (req, res) => {
  const folderPath = path.join(uploadsBasePath, req.params.id);
  const zipFile = findFirstZip(folderPath);

  if (!zipFile) {
    return httpResponses.notFound(res, $`No savedata file found in save directory for ${req.params.id}`);
  }

  const filePath = path.join(folderPath, zipFile);
  sendFileIfExists(res, filePath, zipFile);
});
// 3. Savefile screenshots
router.get('/savefile/:id/scr', (req, res) => {
  const scrPath = path.join(uploadsBasePath, req.params.id, 'scr');
  if (!fs.existsSync(scrPath)) {
    return httpResponses.notFound(res, `Screenshots not found for id ${req.params.id}`);
  }
  createZipAndSend(res, scrPath, `screenshots-${req.params.id}.zip`);
});
// 1. Savefile ZIP
router.get('/savefile/:id/', (req, res) => {
  const savePath = path.join(uploadsBasePath, req.params.id);
  if (!fs.existsSync(savePath)) {
    return httpResponses.notFound(res, `Savedata not found for id ${req.params.id}`);
  }
  return createZipAndSend(res, savePath, `savefile-${req.params.id}.zip`);
});

// 5. User banner
router.get('/user/banner', (req, res) => {
  const userPath = path.join(userBasePath, req.user.id);
  const bannerFile = findFileByBaseName(userPath, 'banner');

  const filePath = bannerFile
    ? path.join(userPath, bannerFile)
    : path.join(defaultsBasePath, process.env.ASSET_BANNER);

  const fileName = bannerFile || process.env.ASSET_BANNER;
  sendFileIfExists(res, filePath, fileName);
});

// 6. User pfp
router.get('/user/pfp', (req, res) => {
  const userPath = path.join(userBasePath, req.user.id);
  const pfpFile = findFileByBaseName(userPath, 'pfp');

  const filePath = pfpFile
    ? path.join(userPath, pfpFile)
    : path.join(defaultsBasePath, process.env.ASSET_PFP);

  const fileName = pfpFile || process.env.ASSET_PFP;
  sendFileIfExists(res, filePath, fileName);
});

// 4. User all images
router.get('/user/:id', (req, res) => {
  const userID = req.params.id;
  const userPath = path.join(userBasePath, userID);
  const archive = archiver('zip', { zlib: { level: 9 } });

  res.attachment(`user-assets-${userID}.zip`);
  archive.pipe(res);

  // Agregar pfp
  const pfpFile = findFileByBaseName(userPath, 'pfp');
  const pfpPath = pfpFile
    ? path.join(userPath, pfpFile)
    : path.join(defaultsBasePath, process.env.ASSET_PFP);
  archive.file(pfpPath, { name: 'pfp' + path.extname(pfpPath) });

  // Agregar banner
  const bannerFile = findFileByBaseName(userPath, 'banner');
  const bannerPath = bannerFile
    ? path.join(userPath, bannerFile)
    : path.join(defaultsBasePath, process.env.ASSET_BANNER);
  archive.file(bannerPath, { name: 'banner' + path.extname(bannerPath) });

  archive.finalize();
});

router.get('/defaults/banner', (req, res) => {
  const bannerPath = path.join(defaultsBasePath, process.env.ASSET_BANNER);
  sendFileIfExists(res, bannerPath, process.env.ASSET_BANNER);
});
router.get('/defaults/game-cover', (req, res) => {
  const gamecoverPath = path.join(defaultsBasePath, process.env.ASSET_GAMECOVER);
  sendFileIfExists(res, gamecoverPath, process.env.ASSET_GAMECOVER);}
);
router.get('/defaults/pfp', (req, res) => {
  const pfppath = path.join(defaultsBasePath, process.env.ASSET_PFP);
  sendFileIfExists(res, pfppath, process.env.ASSET_PFP);
});
// 6. Defaults
router.get('/defaults', (req, res) => {
  return createZipAndSend(res, defaultsBasePath, `gsdb-defaultAssets.zip`);
});

module.exports = router;
