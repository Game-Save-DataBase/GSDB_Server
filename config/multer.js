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
    const uploadPath = path.join(__dirname, '../', config.paths.uploads);
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
    // Obtenemos userId desde req.user
    const userId = req.user?.userID;
    if (!userId) return cb(new Error('User not authenticated'));

    const uploadPath = path.join(__dirname, '../', config.paths.userProfiles, userId.toString());
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Comprobar type aquí mismo para filename
    const type = req.query.type;
    if (!type || !['pfp', 'banner'].includes(type)) {
      return cb(new Error('Invalid or missing type query parameter. Type must be: pfp,banner'));
    }
    cb(null, `${type}${ext}`);
  }
});

const fileFilterUserImage = (req, file, cb) => {
  // Validar type otra vez para más seguridad o para mostrar error antes
  const type = req.query.type;
  if (!type || !['pfp', 'banner'].includes(type)) {
    return cb(new Error('Invalid or missing type query parameter. Type must be: pfp,banner'));
  }

  // Validar tipo archivo
  const allowedTypes = /jpeg|jpg|png|gif/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes.test(ext)) {
    return cb(new Error('Only image files are allowed'));
  }

  cb(null, true);
};


const uploadScreenshot = multer({ storage: screenshotStorage });
const uploadSaveFile = multer({
  storage: saveFileStorage,
  fileFilterUserImage,
  limits: { fileSize: 5 * 1024 * 1024 }
});
const uploadUserImage = multer({ storage: userImageStorage });

module.exports = {
  uploadScreenshot,
  uploadSaveFile,
  uploadUserImage
};
