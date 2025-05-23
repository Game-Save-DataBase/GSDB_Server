const config = require('../utils/config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Screenshots
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const saveId = req.params.saveId;
    const uploadPath = path.join(__dirname, '../' + config.paths.uploads, saveId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `scr_${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Savefiles
const saveFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../' + config.paths.uploads);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `save_${Date.now()}${path.extname(file.originalname)}`);
  }
});

// User profile/banner images
const userImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.params.userId;
    const uploadPath = path.join(__dirname, '../',config.paths.userProfiles,userId);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const type = req.params.type === 'banner' ? 'banner' : 'pfp';
    cb(null, `${type}${ext}`);
  }
});

const uploadScreenshot = multer({ storage: screenshotStorage });
const uploadSaveFile = multer({ storage: saveFileStorage });
const uploadUserImage = multer({
  storage: userImageStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    allowedTypes.test(ext) ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = {
  uploadScreenshot,
  uploadSaveFile,
  uploadUserImage
};
