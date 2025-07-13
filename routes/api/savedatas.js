const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const archiver = require('archiver');
const { uploadSaveFile } = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { SaveDatas } = require('../../models/SaveDatas');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const httpResponses = require('../../utils/httpResponses');
const config = require('../../utils/config')
const { hasStaticFields } = require('../../models/modelRegistry');

const axios = require('axios');

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



async function processSaveFileUpload({ file, user, body }) {
  if (!file) throw new Error('No file uploaded');

  const { gameID, tags, platformID, title, description } = body;
  const tagsArray = Array.isArray(tags) ? tags : [tags];
  const userID = user.userID;

  if (!gameID) throw new Error('Missing gameID');
  const game = await axios.get(`${config.connection}${config.api.games}?gameID=${gameID}&complete=false`);
  if (!game) throw new Error('Game not found');

  // Crear entry temporal en DB para obtener el id (saveID)
  const tempSaveData = await SaveDatas.create({ userID, gameID, platformID, title, description, tags: tagsArray });
  const saveID = tempSaveData.saveID.toString();
  const finalFileName = `gsdb_${saveID}${user.userID}${game.data.gameID}.zip`;
  const uploadPath = path.join(__dirname, '../', '../', config.paths.uploads, saveID);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const finalFilePath = path.join(uploadPath, finalFileName);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(finalFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.file(file.path, { name: file.originalname });
    archive.finalize();
  });

  fs.unlinkSync(file.path);

  tempSaveData.file = finalFileName;
  await tempSaveData.save();

  return tempSaveData;
}


router.post('/', authenticateMW, uploadSaveFile.single('file'), async (req, res) => {
  try {
    const savedata = await processSaveFileUpload({
      file: req.file,
      user: req.user,
      body: req.body
    });

    return httpResponses.created(res, savedata);
  } catch (err) {
    console.error("Error saving savedata:", err);

    // Intentar borrar archivo original si aún existe
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Error deleting uploaded file after failure:", unlinkErr);
      }
    }

    return httpResponses.badRequest(res, err.message || 'Unable to save data');
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

router.delete('/', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    // Buscar savedata a borrar con findByID
    const deleted = await findByID({ id }, 'savedata');
    if (!deleted) return httpResponses.notFound(res, 'Savedata not found');

    await deleted.deleteOne();

    return httpResponses.ok(res, { message: 'Save data deleted successfully' });
  } catch (err) {
    console.error('Error deleting savedata:', err);
    return httpResponses.internalError(res, 'Error deleting save data');
  }
});

router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await SaveDatas.deleteMany({});
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error wiping saves:', err);
    return httpResponses.internalError(res, 'Error wiping saves');
  }
});

module.exports = router;
