const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { buildMongoFilter } = require('../../utils/queryUtils');
const { uploadScreenshot, uploadSaveFile } = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { SaveDatas, filterFields } = require('../../models/SaveDatas');

const httpResponses = require('../../utils/httpResponses');

router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'savedata route testing! :)'));

router.get('/', async (req, res) => {
  try {
    const query = req.query;
    if (query._id) {
      const savedata = await SaveDatas.findById(query._id);
      if (!savedata) return httpResponses.notFound(res, `Savedata with id ${query._id} not found`);
      return httpResponses.ok(res, savedata);
    }

    const filter = buildMongoFilter(query, filterFields);
    const savedatas = await SaveDatas.find(filter);

    if (savedatas.length === 0) return httpResponses.noContent(res, 'No coincidences');
    if (savedatas.length === 1) return httpResponses.ok(res, savedatas[0]);
    return httpResponses.ok(res, savedatas);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') return httpResponses.badRequest(res, error.message);
    return httpResponses.internalError(res);
  }
});

router.get('/:saveId/screenshots', (req, res) => {
  const saveId = req.params.saveId;
  const uploadDir = path.join(__dirname, '../../assets/uploads', saveId);

  if (!fs.existsSync(uploadDir)) {
    return httpResponses.ok(res, { screenshots: [] });
  }

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return httpResponses.noContent(res, { screenshots: [] });
    }
    const screenshotFiles = files.filter(file => file.startsWith('scr_'));
    if (screenshotFiles.length === 0) return httpResponses.noContent(res, { screenshots: [] });

    const screenshots = screenshotFiles.map(file => `/assets/uploads/${saveId}/${file}`);
    return httpResponses.ok(res, { screenshots });
  });
});

router.post('/by-id', async (req, res) => {
  try {
    const ids = (req.body.ids || []).filter(id => !!id);
    if (!ids.length) return httpResponses.ok(res, []);

    const query = req.query;
    let mongoFilter = { _id: { $in: ids } };
    if (Object.keys(query).length) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }

    const saves = await SaveDatas.find(mongoFilter);
    if (saves.length === 1) return httpResponses.ok(res, saves[0]);
    return httpResponses.ok(res, saves);
  } catch (error) {
    return httpResponses.internalError(res);
  }
});

router.post('/', uploadSaveFile.single('file'), authenticateMW, async (req, res) => {
  try {
    if (!req.file) return httpResponses.badRequest(res, 'No file uploaded');

    const newSavedata = new SaveDatas({
      title: req.body.title,
      gameID: req.body.gameID,
      platformID: req.body.platformID,
      description: req.body.description,
      userID: req.body.userID,
      file: '',
    });

    const savedata = await newSavedata.save();

    const saveFolder = path.join(__dirname, '../../assets/uploads', savedata._id.toString());
    if (!fs.existsSync(saveFolder)) fs.mkdirSync(saveFolder, { recursive: true });

    const originalPath = req.file.path;
    const newFilePath = path.join(saveFolder, req.file.filename);

    fs.renameSync(originalPath, newFilePath);

    savedata.file = `/assets/uploads/${savedata._id}/${req.file.filename}`;
    await savedata.save();

    return httpResponses.created(res, savedata);
  } catch (err) {
    console.error("Error saving savedata:", err);
    return httpResponses.badRequest(res, 'Unable to save data');
  }
});

router.put('/:id', authenticateMW, async (req, res) => {
  try {
    const savedata = await SaveDatas.findByIdAndUpdate(req.params.id, req.body);
    if (!savedata) return httpResponses.notFound(res, 'Savedata not found');
    return httpResponses.ok(res, { msg: 'Updated successfully' });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the Database');
  }
});



router.get('/:id/download', authenticateMW, async (req, res) => {
  try {
    const saveData = await SaveDatas.findById(req.params.id);
    if (!saveData || !saveData.file) return httpResponses.notFound(res, 'Savedata not found');

    const filePath = path.join(__dirname, '../../assets/uploads', saveData._id.toString(), path.basename(saveData.file));
    if (!fs.existsSync(filePath)) return httpResponses.notFound(res, 'File not found');

    saveData.nDownloads = (saveData.nDownloads || 0) + 1;
    await saveData.save();

    res.download(filePath, path.basename(saveData.file));
    return httpResponses.ok(res, { message: 'Downloaded correctly' });

  } catch (err) {
    console.error("Error while downloading:", err);
    return httpResponses.internalError(res, 'Error processing download');
  }
});

router.post('/:saveId/screenshots', uploadScreenshot.single('image'), authenticateMW, (req, res) => {
  if (!req.file) return httpResponses.badRequest(res, 'No file uploaded');

  return httpResponses.created(res, {
    message: 'File uploaded successfully',
    filePath: `/assets/uploads/${req.params.saveId}/${req.file.filename}`
  });
});


// DELETE /:id eliminar usuario
router.delete('/:id', authenticateMW, async (req, res) => {
  try {
    const deleted = await SaveDatas.findByIdAndDelete(req.params.id);
    if (!deleted) return httpResponses.notFound(res, 'User not found');

    const userFolderPath = path.join(__dirname, '..', '..', 'uploads', req.params.id);
    try {
      await fs.rm(userFolderPath, { recursive: true, force: true });
    } catch (fsErr) {
      console.error(`Error deleting folder for user ${req.params.id}:`, fsErr);
    }

    return httpResponses.ok(res, { message: 'User deleted successfully' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error deleting user');
  }
});


// DELETE /dev/wipe borrar todos usuarios
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const resultado = await SaveDatas.deleteMany({});

    const savesPath = path.join(__dirname, '..', '..', 'assets', 'uploads');
    try {
      const folders = await fs.readdir(savesPath, { withFileTypes: true });
      const folderDeletions = folders
        .filter(dirent => dirent.isDirectory())
        .map(dirent => fs.rm(path.join(savesPath, dirent.name), { recursive: true, force: true }));
      await Promise.all(folderDeletions);
    } catch (fsErr) {
      console.error('Error deleting saves folders:', fsErr);
    }

    return httpResponses.ok(res, { deletedCount: resultado.deletedCount });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping saves');
  }
});



module.exports = router;
