const config = require('../utils/config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Savefiles
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../', config.paths.uploads);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `screenshot_${Date.now()}_${path.extname(file.originalname)}`);
  }
});

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

const uploadSaveDataFiles = multer({
  storage: saveFileStorage, // por defecto, todos se guardan en la misma carpeta
  limits: { fileSize: 20 * 1024 * 1024 }, // por ejemplo 20MB máx
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'file') {
      return cb(null, true); // savefile
    }
    if (file.fieldname === 'screenshots') {
      const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
      if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
        return cb(new Error(`Screenshots must be ${allowed.join(', ')} `));
      }
      return cb(null, true);
    }
    cb(new Error('Invalid field'));
  }
});
const uploadUserImage = multer({ storage: userImageStorage });

module.exports = {
  uploadSaveDataFiles ,
  uploadUserImage
};
