const express = require('express');
const router = express.Router();
const { authenticateMW, checkLoggedUserMW } = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const httpResponses = require('../../utils/httpResponses');
const config = require('../../utils/config');
const axios = require('axios');
const { SaveDatas } = require('../../models/SaveDatas');
const { Users } = require('../../models/Users');

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

async function addSaveToUserHistory(loggedUser, saveId) {
  // Si hay usuario logueado, añadir al historial
  if (loggedUser) {
    try {
      await Users.findByIdAndUpdate(
        loggedUser._id,
        { $push: { downloadHistory: saveId } }
      );
    } catch (err) {
      console.error("Error al actualizar downloadHistory:", err);
    }
  }

}
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


// 3. Savefile screenshots
router.get('/savedata/:id/scr', async (req, res) => {
  const folderPath = path.join(uploadsBasePath, req.params.id);
  const scrPath = path.join(uploadsBasePath, req.params.id, 'scr');
  if (!fs.existsSync(scrPath)) {
    return httpResponses.noContent(res);
  }
  const fileName = findFirstZip(folderPath) || `${req.params.id}.zip`;
  createZipAndSend(res, scrPath, `screenshots-${fileName}`);
});
// 3. Savefile main screenshot
router.get('/savedata/:id/scr/main', async (req, res) => {
  const scrPath = path.join(uploadsBasePath, req.params.id, 'scr');

  if (!fs.existsSync(scrPath)) {
    return httpResponses.noContent(res);
  }

  // Leer y ordenar archivos
  const files = fs.readdirSync(scrPath)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    return httpResponses.noContent(res);
  }

  const firstScreenshotPath = path.join(scrPath, files[0]);

  // Enviar la imagen directamente
  res.sendFile(firstScreenshotPath, err => {
    if (err) {
      console.error("Error sending screenshot:", err);
      return httpResponses.serverError(res, "Unable to send screenshot");
    }
  });
});




// 1. Savefile + screenshots
router.get('/savedata/:id/bundle', checkLoggedUserMW, async (req, res) => {
  const saveId = req.params.id;
  const savePath = path.join(uploadsBasePath, saveId);
  const scrPath = path.join(savePath, 'scr');

  if (!fs.existsSync(savePath)) {
    return httpResponses.notFound(res, `Savedata not found for id ${saveId}`);
  }

  const saveZip = findFirstZip(savePath);
  const hasScreenshots = fs.existsSync(scrPath);

  const baseName = path.parse(saveZip || saveId).name;
  const zipName = `bundle-${baseName}.zip`;

  // Si no hay screenshots, y hay un zip, simplemente lo enviamos
  if (!hasScreenshots && saveZip) {
    const zipFilePath = path.join(savePath, saveZip);
    return sendFileIfExists(res, zipFilePath, zipName); // Usamos zipName aquí
  }

  // Si hay screenshots o no hay zip, construimos un ZIP a mano
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment(zipName);
  archive.pipe(res);

  // Añadir el archivo ZIP principal si existe
  if (saveZip) {
    const zipFilePath = path.join(savePath, saveZip);
    archive.file(zipFilePath, { name: saveZip });

    // Buscar savedata y sumar numero de descargas
    const saveEntry = await SaveDatas.findOne({ saveID: Number(saveId) });
    saveEntry.nDownloads = saveEntry.nDownloads + 1
    addSaveToUserHistory(req.loggedUser, saveId);
    await saveEntry.save();
  }

  // Añadir carpeta de screenshots si existe
  if (hasScreenshots) {
    archive.directory(scrPath, 'scr');
  }

  archive.finalize();
});

// 2. Savefile main file
router.get('/savedata/:id', checkLoggedUserMW, async (req, res) => {
  const folderPath = path.join(uploadsBasePath, req.params.id);
  const zipFile = findFirstZip(folderPath);

  if (!zipFile) {
    return httpResponses.notFound(res, $`No savedata file found in save directory for ${req.params.id}`);
  }

  const filePath = path.join(folderPath, zipFile);
  // Buscar savedata y sumar numero de descargas
  const saveEntry = await SaveDatas.findOne({ saveID: Number(req.params.id) });
  saveEntry.nDownloads = saveEntry.nDownloads + 1
  addSaveToUserHistory(req.loggedUser, req.params.id);
  await saveEntry.save();
  sendFileIfExists(res, filePath, zipFile);
});


// 5. User banner
router.get('/user/:id/banner', (req, res) => {
  const userPath = path.join(userBasePath, req.params.id);
  const bannerFile = findFileByBaseName(userPath, 'banner');

  const filePath = bannerFile
    ? path.join(userPath, bannerFile)
    : path.join(defaultsBasePath, process.env.ASSET_BANNER);

  const fileName = bannerFile || process.env.ASSET_BANNER;
  sendFileIfExists(res, filePath, fileName);
});

// 6. User pfp
router.get('/user/:id/pfp', (req, res) => {
  const userPath = path.join(userBasePath, req.params.id);
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
  sendFileIfExists(res, gamecoverPath, process.env.ASSET_GAMECOVER);
}
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
