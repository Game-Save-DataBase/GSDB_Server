// routes/api/savedatas.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const {uploadScreenshot, uploadSaveFile} = require('../../config/multer');
// Load savedata model
const SaveDatas = require('../../models/savedatas');




// @route   GET api/savedatas/test
// @desc    Tests savedatas route
// @access  Public
router.get('/test', (req, res) => res.send('savedata route testing!'));

// @route   GET api/savedatas
// @desc    Get all savedatas
// @access  Public
router.get('/', (req, res) => {
  SaveDatas.find()
    .then(savedatas => res.json(savedatas))
    .catch(err => res.status(404).json({ nosavedatasfound: 'No savedatas found' }));
});

// @route   GET api/savedatas/:id
// @desc    Get single savedata by id
// @access  Public
router.get('/:id', (req, res) => {
  SaveDatas.findById(req.params.id)
    .then(savedata => res.json(savedata))
    .catch(err => res.status(404).json({ nosavedatafound: 'No savedata found' }));
});


//nuevos endpoints:
// @route   GET api/savedatas/:gameID
// @desc    Get all savedatas by gameID
// @access  Public
router.get('/game/:gameID', (req, res) => {
  const gameID = req.params.gameID;
  SaveDatas.find({ gameID: gameID })
    .then(savedatas => {
      if (savedatas.length === 0) {
        return res.status(404).json({ nosavedatasfound: 'No savedatas found for this gameID' });
      }
      res.json(savedatas);
    })
    .catch(err => res.status(404).json({ error: 'Error fetching savedatas' }));
});

// @route   POST api/savedatas
// @desc    Create savedata
// @access  Public
router.post('/', uploadSaveFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Primero, creamos el documento con ruta temporal
    const newSavedata = new SaveDatas({
      title: req.body.title,
      gameID: req.body.gameID,
      platformID: req.body.platformID,
      description: req.body.description,
      userID: req.body.userID,
      file: '', // Ruta temporal, la actualizaremos luego
    });

    const savedata = await newSavedata.save();

    // Crear carpeta con el _id
    const saveFolder = path.join(__dirname, '../../assets/uploads', savedata._id.toString());
    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Ruta de destino del archivo
    const originalPath = req.file.path;
    const fileExt = path.extname(req.file.filename);
    const newFileName = 'save' + fileExt;
    const newFilePath = path.join(saveFolder, req.file.filename);

    // Mover archivo
    fs.renameSync(originalPath, newFilePath);

    // Actualizar la ruta en el documento
    savedata.file = `/assets/uploads/${savedata._id}/${req.file.filename}`;
    await savedata.save();

    res.json(savedata);

  } catch (err) {
    console.error("Error saving savedata:", err);
    res.status(400).json({ error: 'Unable to save data' });
  }
});


// @route   PUT api/savedatas/:id
// @desc    Update savedata by id
// @access  Public
router.put('/:id', (req, res) => {
  SaveDatas.findByIdAndUpdate(req.params.id, req.body)
    .then(savedata => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/savedatas/:id
// @desc    Delete savedata by id
// @access  Public
router.delete('/:id', (req, res) => {
  SaveDatas.findByIdAndDelete(req.params.id)
    .then(savedata => res.json({ mgs: 'savedata entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a savedata' }));
});


//      SCREENSHOTS

// @route   GET api/savedatas/:saveId/screenshots
// @desc    Get screenshot paths for a specific saveId
// @access  Public
router.get('/:saveId/screenshots', (req, res) => {
  const saveId = req.params.saveId;

  // Ruta base donde se almacenan las imágenes
  const uploadDir = path.join(__dirname, '../../assets/uploads', saveId);

  if (!fs.existsSync(uploadDir)) {
    return res.json({ screenshots: [] });
  }

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.json({ screenshots: [] }); // Devuelve un JSON vacío si hay error al leer el directorio
    }
    // Filtrar las imágenes que comienzan con "scr_"
    const screenshotFiles = files.filter(file => file.startsWith('scr_'));
    // Si no se encuentran imágenes
    if (screenshotFiles.length === 0) {
      return res.json({ screenshots: [] }); // Devuelve un JSON vacío si no se encuentran imágenes
    }
    // Crear un array de rutas de las imágenes
    const screenshots = screenshotFiles.map(file => `/assets/uploads/${saveId}/${file}`);

    res.json({ screenshots: screenshots });
  });
});

// @route   POST api/savedatas/:saveId/screenshots
// @desc    Upload an screenshot for a specific saveId
// @access  Public
router.post('/:saveId/screenshots', uploadScreenshot.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ message: 'File uploaded successfully', filePath: `/assets/uploads/${req.params.saveId}/${req.file.filename}` });
});

module.exports = router;