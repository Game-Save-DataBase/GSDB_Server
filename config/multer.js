const config = require('../utils/config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');



const saveFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = (process.env.NODE_ENV === 'production') ? config.paths.uploads : path.join(__dirname, '../', config.paths.uploads);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'file') {
      cb(null, `save_${Date.now()}${ext}`);
    } else if (file.fieldname === 'screenshots') {
      cb(null, `scr_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
    } else {
      cb(new Error('Invalid fieldname'));
    }
  }
});


// User profile/banner images
const userImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Obtenemos userId desde req.user
    const userId = req.user?.userID;
    if (!userId) return cb(new Error('User not authenticated'));

    const uploadPath = (process.env.NODE_ENV === 'production') ?
      path.join(config.paths.userProfiles, userId.toString())
     : path.join(__dirname, '../', config.paths.userProfiles, userId.toString());
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
  uploadSaveDataFiles,
  uploadUserImage
};
