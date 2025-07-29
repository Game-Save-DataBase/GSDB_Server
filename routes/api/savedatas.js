const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const archiver = require('archiver');
const { uploadSaveFile } = require('../../config/multer');
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { SaveDatas } = require('../../models/SaveDatas');
const { Games } = require('../../models/Games');
const { Users } = require('../../models/Users');
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
  tempSaveData.fileSize = file.size;
  await tempSaveData.save();

  return tempSaveData;
}


async function updateGameAfterUpload(gameID, saveID) {
  let game = await axios.get(`${config.connection}${config.api.games}?gameID=${gameID}&external=false`);
  if (!game.data) {
    //lo creamos
    let resPost = await axios.post(`${config.connection}${config.api.games}/igdb`, { IGDB_ID: Number(gameID) });
  }

  game = await Games.findOne({ gameID: Number(gameID) });
  console.log(game)
  if (game) {
    if (!game.saveID.includes(saveID)) {
      game.saveID.push(saveID);
      await game.save();
    }
  }
}
async function updateUserAfterUpload(loggedUser, saveID) {
  if (!loggedUser.uploads.includes(saveID)) {
    loggedUser.uploads.push(saveID);
    await loggedUser.save();
  }
}

router.post('/', authenticateMW, uploadSaveFile.single('file'), async (req, res) => {
  try {
    const savedata = await processSaveFileUpload({
      file: req.file,
      user: req.user,
      body: req.body
    });

    await updateGameAfterUpload(req.body.gameID, savedata.saveID)
    await updateUserAfterUpload(req.user, savedata.saveID)

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

router.put('/update-rating', authenticateMW, async (req, res) => {
  try {
    const { id, mode } = req.query;
    const userID = req.user.userID;

    if (!id || !['like', 'dislike'].includes(mode)) {
      return httpResponses.badRequest(res, 'Missing or invalid "id" or "mode" in query');
    }

    const savedata = await findByID({ id }, 'savedata');
    if (!savedata) return httpResponses.notFound(res, 'Savedata not found');

    // Accedemos directamente
    const alreadyLiked = savedata.likes.includes(userID);
    const alreadyDisliked = savedata.dislikes.includes(userID);

    // Añadir al array correspondiente si no está
    if (mode === 'like' && !alreadyLiked) {
      savedata.likes.push(userID);
      req.user.likes.push(savedata.saveID)
    } else if (mode === 'dislike' && !alreadyDisliked) {
      savedata.dislikes.push(userID);
      req.user.dislikes.push(savedata.saveID)
    }

    // Quitar del otro array si estaba
    if (mode === 'like' && alreadyDisliked) {
      savedata.dislikes = savedata.dislikes.filter(uid => uid !== userID);
      req.user.dislikes = req.user.dislikes.filter(sid => sid !== savedata.saveID);
    } else if (mode === 'dislike' && alreadyLiked) {
      savedata.likes = savedata.likes.filter(uid => uid !== userID);
      req.user.likes = req.user.likes.filter(sid => sid !== savedata.saveID);
    }

    await savedata.save();
    await req.user.save();

    return httpResponses.ok(res, {
      msg: `Savedata "${mode}"d successfully`,
      likes: savedata.likes.length,
      dislikes: savedata.dislikes.length,
    });
  } catch (err) {
    console.error('Error updating rating:', err);
    return httpResponses.internalError(res, 'Failed to update rating');
  }
});

router.put('/reset-rating', authenticateMW, async (req, res) => {
  const { id } = req.query;

  const savedata = await findByID({ id }, 'savedata');
  if (!savedata) return httpResponses.notFound(res, 'Savedata not found');

  try {
    // Quitar del otro array si estaba
    savedata.likes = savedata.likes.filter(uid => uid !== req.user.userID);
    savedata.dislikes = savedata.dislikes.filter(uid => uid !== req.user.userID);
    req.user.likes = req.user.likes.filter(sid => sid !== savedata.saveID);
    req.user.dislikes = req.user.dislikes.filter(sid => sid !== savedata.saveID);


    await savedata.save();
    await req.user.save();

    return httpResponses.ok(res, {
      msg: `Savedata likes and dislikes reseted successfully for userID ${req.user.userID}`,
      likes: savedata.likes.length,
      dislikes: savedata.dislikes.length,
    });
  } catch (err) {
    console.error('Error updating rating:', err);
    return httpResponses.internalError(res, 'Failed to update rating');
  }
});


router.delete('/', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    // Buscar savedata a borrar con findByID
    const deleted = await findByID({ id }, 'savedata');
    if (!deleted) return httpResponses.notFound(res, 'Savedata not found');
    const gameID = deleted.gameID

    await deleted.deleteOne();
    const game = await Games.findOne({ gameID: Number(gameID) });
    if (game) {
      game.nUploads -= 1;
      await game.save();
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
    await Games.updateMany({}, { $set: { nUploads: 0, lastUpdate: null } });
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error wiping saves:', err);
    return httpResponses.internalError(res, 'Error wiping saves');
  }
});

module.exports = router;
