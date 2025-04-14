const config = require('../utils/config');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Para screenshots
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const saveId = req.params.saveId;
    const uploadPath = path.join(__dirname, '../'+config.paths.uploads, saveId);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `scr_${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Para archivos normales de guardado
const saveFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../'+config.paths.uploads);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `save_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadScreenshot = multer({ storage: screenshotStorage });
const uploadSaveFile = multer({ storage: saveFileStorage });

module.exports = {
  uploadScreenshot,
  uploadSaveFile
};
