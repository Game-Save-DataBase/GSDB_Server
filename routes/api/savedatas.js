// routes/api/savedatas.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const upload = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW'); // <== middleware


// @route   GET api/savedatas/test
// @desc    Tests savedatas route
// @access  Public
router.get('/test', (req, res) => res.send('savedata route testing!'));

router.use(authenticateMW);



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
router.post('/:saveId/screenshots', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ message: 'File uploaded successfully', filePath: `/assets/uploads/${req.params.saveId}/${req.file.filename}` });
});

// Load savedata model
const SaveDatas = require('../../models/savedatas');


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
// @desc    Add/save savedata
// @access  Public
router.post('/', (req, res) => {
  SaveDatas.create(req.body)
    .then(savedata => res.json({ msg: 'savedata added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this savedata' }));
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



module.exports = router;