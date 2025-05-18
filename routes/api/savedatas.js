// routes/api/savedatas.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { buildMongoFilter } = require('../../utils/mongoutils');

const { uploadScreenshot, uploadSaveFile } = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode

// Load savedata model
const { SaveDatas, filterFields } = require('../../models/SaveDatas');


/**
 * @route GET api/savedatas/test
 * @desc  testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => res.send('savedata route testing! :)'));


/**
 * @route GET api/savedatas
 * @params see models/savedatas
 * @desc get all coincidences that matches with query filters. It supports mongodb operands
 *        using no filter returns all coincidences
 * @access public TO DO el uso del id de la base de datos no deberia ser publico para todo el mundo. Quizas deberiamos crear un id propio
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;
    //buscamos primero con el id de mongodb, si no, comenzamos a filtrar
    if (query._id) {
      const savedata = await SaveDatas.findById(query._id);
      if (!savedata) return res.status(404).json({ msg: `Savedata with id ${query._id} not found` });
      return res.json(savedata);
    }
    const filter = buildMongoFilter(query, filterFields);

    const savedatas = await SaveDatas.find(filter);

    if (savedatas.length === 0) {
      return res.status(404).json({ msg: 'No coincidences' });
    }
    if (savedatas.length === 1) {
      return res.json(savedatas[0]);
    }
    return res.json(savedatas);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route GET api/savedatas/:saveID/screenshots
 * @desc Get screenshot paths for a specific saveId
 * @access public TO DO no deberia ser accesible mas alla de la web ya que revela rutas
 */

router.get('/:saveId/screenshots', (req, res) => {
  const saveId = req.params.saveId;

  // Ruta relativa base donde se almacenan las imágenes
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


/**
 * @route POST api/savedatas/by-id
 * @body ids = [String] :mongodb _id
 * @params see models/savedatas
 * @desc Get all savedatas that matches with id array. It supports query params with mongodb operands
 * @access public TO DO no deberia ser accesible para todo el mundo ya que usa los id de la base de datos. Quizas deberiamos usar un id propio
 */

router.post('/by-id', async (req, res) => {
  try {
    // Limpiamos arrays: quitamos elementos falsy (como "")
    const ids = (req.body.ids || []).filter(id => !!id);
    if (!ids || ids.length === 0) {
      return res.json(); // Devuelve un array vacio (a diferencia del get general)
    }
    const query = req.query;

    let mongoFilter = { _id: { $in: ids } };

    // Añadir filtros si hay parámetros en la query
    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }
    const saves = await SaveDatas.find(mongoFilter);
    if (saves.length === 1) {
      return res.json(saves[0]);
    }
    return res.json(saves);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching saves by ids', error });
  }
});


/**
 * @route POST api/savedatas/
 * @desc Create savedata
 * @body see models/savedatas.sj
 * @access auth 
 */
router.post('/', uploadSaveFile.single('file'), authenticateMW, async (req, res) => {
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


/**
 * @route PUT api/savedatas/
 * @desc Modify savedata
 * @body see models/savedatas.sj
 * @access auth 
 */
router.put('/:id', authenticateMW, (req, res) => {
  SaveDatas.findByIdAndUpdate(req.params.id, req.body)
    .then(savedata => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});


/**
 * @route DELETE api/savedatas/:id
 * @desc Delete single savedata
 * @access auth 
 */
router.delete('/:id', authenticateMW, async (req, res) => {
  try {
    const savedata = await SaveDatas.findByIdAndDelete(req.params.id);
    if (!savedata) {
      return res.status(404).json({ error: 'Savedata not found' });
    }

    // 🧹 Eliminar carpeta asociada al savedata
    const screenshotFolder = path.join(__dirname, '../../assets/uploads', savedata._id.toString());

    if (fs.existsSync(screenshotFolder)) {
      fs.rmSync(screenshotFolder, { recursive: true, force: true });
    }

    res.json({ message: 'Savedata and associated files deleted' });

  } catch (err) {
    console.error("Error deleting savedata:", err);
    res.status(500).json({ error: 'Unable to delete data' });
  }
});


/**
 * @route GET api/:id/download/
 * @desc returns server path for downloading
 * @access auth TO DO ??? como manejamos esto, deberia ser publico, no, como devolvemos un archivo sin saber la ruta, etc
 */
router.get('/:id/download', authenticateMW, async (req, res) => {
  try {
    const saveData = await SaveDatas.findById(req.params.id);
    if (!saveData || !saveData.file) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const filePath = path.join(__dirname, '../../assets/uploads', saveData._id.toString(), path.basename(saveData.file));

    // Verifica si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'El archivo no existe en el servidor' });
    }

    // Incrementar contador de descargas
    saveData.nDownloads = (saveData.nDownloads || 0) + 1;
    await saveData.save();

    // Fuerza la descarga
    res.download(filePath, path.basename(saveData.file));

  } catch (err) {
    console.error("Error al descargar archivo:", err);
    res.status(500).json({ error: 'Error al procesar la descarga' });
  }
});




/**
 * @route POST api/:saveID/screenshots/
 * @desc Uploads savedata screenshots
 * @access auth 
 */
router.post('/:saveId/screenshots', uploadScreenshot.single('image'), authenticateMW, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({ message: 'File uploaded successfully', filePath: `/assets/uploads/${req.params.saveId}/${req.file.filename}` });
});

module.exports = router;