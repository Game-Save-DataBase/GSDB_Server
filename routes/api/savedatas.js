const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { uploadSaveFile } = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { SaveDatas } = require('../../models/SaveDatas');
const { findByID, findByQuery } = require('../../utils/queryUtils');
const httpResponses = require('../../utils/httpResponses');
const config = require('../../utils/config')
const { hasStaticFields } = require('../../models/modelRegistry');


router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'savedata route testing! :)'));


/**
 * @route GET api/savedatas
 * @desc get savedatas matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    // Buscar por id si viene en la query
    const fastResult = await findByID(query, 'savedata');
    if (fastResult !== undefined) {
      if (!fastResult) {
        return httpResponses.noContent(res, 'No coincidences');
      }
      return httpResponses.ok(res, fastResult);
    }

    // Buscar por query completo
    const results = await findByQuery(query, 'savedata');
    if (results.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }
    return httpResponses.ok(res, results.length === 1 ? results[0] : results);

  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res);
  }
});


router.post('/', authenticateMW, uploadSaveFile.single('file'), async (req, res) => {
  try {
    if (!req.file) return httpResponses.badRequest(res, 'No file uploaded');

    // Agregamos el file y userID directo al body para crear el documento con create()
    const newData = {
      ...req.body,
      userID: req.user.id,
      file: `${req.file.filename}`,
      tags: Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]

    };

    const savedata = await SaveDatas.create(newData);

    return httpResponses.created(res, savedata);
  } catch (err) {
    console.error("Error saving savedata:", err);
    // Intentar borrar el archivo subido si existió
    if (req.file && req.file.path) {
      try {
        fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error("Error deleting uploaded file after save failure:", unlinkErr);
      }
    }
    return httpResponses.badRequest(res, 'Unable to save data');
  }
});


router.put('/', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    if (hasStaticFields(req.body)) {
      return httpResponses.badRequest(res, 'Body contains invalid or non existent fields to update');
    }

    const savedata = await findByID({ id }, 'savedata');
    if (!savedata) return httpResponses.notFound(res, 'Savedata not found');

    Object.assign(savedata, req.body);
    await savedata.save();

    return httpResponses.ok(res, { msg: 'Updated successfully' });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the Database');
  }
});

const uploadsRoot = path.join(__dirname, '..', '..', config.paths.uploads);
router.get('/download', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    const saveData = await findByID({ id }, 'savedata');
    if (!saveData || !saveData.file) return httpResponses.notFound(res, 'Savedata not found');

    const filePath = path.join(uploadsRoot, saveData.id.toString(), path.basename(saveData.file));

    if (!fs.existsSync(filePath)) return httpResponses.notFound(res, 'File not found');

    saveData.nDownloads = (saveData.nDownloads || 0) + 1;
    await saveData.save();

    return res.download(filePath, path.basename(saveData.file));
  } catch (err) {
    console.error("Error while downloading:", err);
    return httpResponses.internalError(res, 'Error processing download');
  }
});


router.delete('/', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    // Buscar usuario a borrar con findByID
    const deleted = await findByID({ id }, 'savedata');
    if (!deleted) return httpResponses.notFound(res, 'Savedata not found');

    await deleted.remove();

    const saveFolderPath = path.join(uploadsRoot, deleted.id.toString());
    try {
      await fs.rm(saveFolderPath, { recursive: true, force: true });
    } catch (fsErr) {
      console.error(`Error deleting folder for savedata ${deleted.id}:`, fsErr);
    }

    return httpResponses.ok(res, { message: 'Save data deleted successfully' });
  } catch (err) {
    console.error('Error deleting savedata:', err);
    return httpResponses.internalError(res, 'Error deleting save data');
  }
});

router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await SaveDatas.deleteMany({});

    try {
      const folders = await fs.readdir(uploadsRoot, { withFileTypes: true });
      const deletions = folders
        .filter(dirent => dirent.isDirectory())
        .map(dirent => fs.rm(path.join(uploadsRoot, dirent.name), { recursive: true, force: true }));

      await Promise.all(deletions);
    } catch (fsErr) {
      console.error('Error deleting saves folders:', fsErr);
    }

    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error wiping saves:', err);
    return httpResponses.internalError(res, 'Error wiping saves');
  }
});

module.exports = router;
