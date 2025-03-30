const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const saveId = req.params.saveId; // Obtener el ID del saveData
    const uploadPath = path.join(__dirname, '../assets/uploads', saveId);

    // Crear la carpeta si no existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `scr_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

module.exports = upload;
