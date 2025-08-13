const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const archiver = require('archiver');
const { uploadSaveDataFiles } = require('../../config/multer');
const { authenticateMW } = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { SaveDatas } = require('../../models/SaveDatas');
const { Games } = require('../../models/Games');
const { Users } = require('../../models/Users');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const httpResponses = require('../../utils/httpResponses');
const config = require('../../utils/config')
const { hasStaticFields } = require('../../models/modelRegistry');
const { scanFileWithVirusTotal, isFileMalicious } = require('../../utils/virusTotal');

const axios = require('axios');

router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'savedata route testing! :)'));
const { sendNotification } = require('../../scripts/sendNotification');


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

router.get('/search', async (req, res) => {
  try {
    const searchValue = req.query.q || "";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const fast = req.query.fast;
    delete req.query.fast;
    let query;

    if (!fast) {
      query = {
        title: { like: searchValue, __or: true },
        description: { like: searchValue, __or: true },
        'game.title': { like: searchValue, __or: true },
        'platform.name': { like: searchValue, __or: true },
        'platform.abbreviation': { like: searchValue, __or: true },
        'user.bio': { like: searchValue, __or: true },
        'user.alias': { like: searchValue, __or: true },
        'user.userName': { like: searchValue, __or: true }
      };
    } else {
      query = {
        title: { like: searchValue }
      };
    }

    if (limit) query.limit = limit;
    if (offset) query.offset = offset;
    if (!fast) {
      if (req.query.platformID) query.platformID = req.query.platformID;
      if (req.query.postedDate) query.postedDate = req.query.postedDate;
      if (req.query.tagID) query.tagID = req.query.tagID;
    }

    // findByQuery ahora usará buildMongoFilter que respeta __or por campo (directo y relacional)
    const data = await findByQuery(query, 'savedata');
    if (!Array.isArray(data) || data.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    const normalizedQuery = searchValue.trim().toLowerCase();
    const sorted = data.sort((a, b) => {
      const aTitle = (a.title || "").toLowerCase();
      const bTitle = (b.title || "").toLowerCase();
      const aIndex = aTitle.indexOf(normalizedQuery);
      const bIndex = bTitle.indexOf(normalizedQuery);

      if (aTitle.startsWith(normalizedQuery) && !bTitle.startsWith(normalizedQuery)) return -1;
      if (!aTitle.startsWith(normalizedQuery) && bTitle.startsWith(normalizedQuery)) return 1;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return aTitle.length - bTitle.length;
    });

    return httpResponses.ok(res, sorted);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, error.message);
  }
});


async function processSaveFileUpload({ file, user, body, screenshots = [] }) {
  if (!file) throw new Error('No savefile uploaded');

  const { gameID, tagID, platformID, title, description } = body;
  const tagsArray = Array.isArray(tagID) ? tagID : [tagID];
  const userID = user.userID;

  if (!gameID) throw new Error('Missing gameID');
  const game = await axios.get(`${config.connection}${config.api.games}?gameID=${gameID}&complete=false`);
  if (!game) throw new Error('Game not found');

  const tempSaveData = await SaveDatas.create({ userID, gameID, platformID, title, description, tagID: tagsArray });
  const saveID = tempSaveData.saveID.toString();
  const uploadPath = path.join(__dirname, '../', '../', config.paths.uploads, saveID);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  // Guardar savefile como zip
  const finalFileName = `gsdb_${saveID}${user.userID}${game.data.gameID}.zip`;
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
  // Mover capturas si hay
  // const screenshotNames = [];
  const scrFolder = path.join(uploadPath, "scr");

  // Crear carpeta "scr" si no existe
  if (!fs.existsSync(scrFolder)) {
    fs.mkdirSync(scrFolder, { recursive: true });
  }

  // Quitar la extensión .zip de finalFileName
  const baseName = finalFileName.replace(/\.zip$/i, "");
  let counter = 1;
  //recorre las screenshots
  for (const shot of screenshots) {
    const newName = `scr${String(counter).padStart(2, "0")}_${baseName}${path.extname(shot.filename)}`;
    // Ruta de destino
    const destPath = path.join(scrFolder, newName);
    fs.renameSync(shot.path, destPath);
    // screenshotNames.push(newName);
    counter++;
  }


  tempSaveData.file = finalFileName;
  tempSaveData.fileSize = file.size;
  await tempSaveData.save();

  return tempSaveData;
}


async function updateGameAfterUpload(gameID, saveID) {
  let game = await axios.get(`${config.connection}${config.api.games}?gameID=${gameID}&external=false`);
  if (!game.data) {
    //lo creamos
    let resPost = await axios.post(
      `${config.connection}${config.api.games}/igdb`,
      { IGDB_ID: Number(gameID) },
      {
        headers: {
          'X-Internal-Token': process.env.INTERNAL_MW_KEY
        }
      }
    );
  }

  game = await Games.findOne({ gameID: Number(gameID) });
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

router.post('/', authenticateMW, uploadSaveDataFiles.fields([
  { name: 'file', maxCount: 1 },
  { name: 'screenshots', maxCount: 4 }
]), async (req, res) => {
  try {
    const savedata = await processSaveFileUpload({
      file: req.files?.file?.[0],
      user: req.user,
      body: req.body,
      screenshots: req.files?.screenshots || []
    });

    await updateGameAfterUpload(req.body.gameID, savedata.saveID)
    await updateUserAfterUpload(req.user, savedata.saveID)

    return httpResponses.created(res, savedata);
  } catch (err) {
    console.error("Error saving savedata:", err);
    // Borrar cualquier archivo subido si falla
    const allFiles = [
      ...(req.files?.file || []),
      ...(req.files?.screenshots || [])
    ];
    for (const f of allFiles) {
      if (f?.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (unlinkErr) {
          console.error("Error deleting uploaded file after failure:", unlinkErr);
        }
      }
    }

    return httpResponses.badRequest(res, err.message || 'Unable to save data');
  }
});

// ------------ ASYN PROCESS
async function asyncProcessSaveFileUpload(file, user, body, screenshots = []) {
  try {

    if (!file) throw new Error('No savefile uploaded');


    const { gameID, tagID, platformID, title, description } = body;
    const tagsArray = Array.isArray(tagID) ? tagID : [tagID];
    const userID = user.userID;

    if (!gameID) throw new Error('Missing gameID');
    const game = await axios.get(`${config.connection}${config.api.games}?gameID=${gameID}&complete=false`);
    if (!game) throw new Error('Game not found');

    const tempSaveData = await SaveDatas.create({ userID, gameID, platformID, title, description, tagID: tagsArray });
    const saveID = tempSaveData.saveID.toString();
    const uploadPath = path.join(__dirname, '../', '../', config.paths.uploads, saveID.toString());
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const finalFileName = `gsdb_${saveID}${user.userID}${gameID}.zip`;
    const finalFilePath = path.join(uploadPath, finalFileName);

    // Crear zip
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(finalFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.file(file.path, { name: file.originalname });
      archive.finalize();
    });

    console.log("Proceso asincrono iniciado")
    await sendNotification({
      userIDs: user.userID,
      type: 3,
      args: { game: game.data }
    });

    const vtReport = await scanFileWithVirusTotal(finalFilePath);
    if (isFileMalicious(vtReport)) {
      // Limpiar archivos
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
      await SaveDatas.deleteOne({ saveID }); // borra registro malicioso

      await sendNotification({
        userIDs: user.userID,
        type: 4,
        args: { game: game.data }
      });
      return;
    }

    // Limpiar archivo temporal original
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // Mover capturas si hay
    const screenshotNames = [];
    const scrFolder = path.join(uploadPath, "scr");

    // Crear carpeta "scr" si no existe
    if (!fs.existsSync(scrFolder)) {
      fs.mkdirSync(scrFolder, { recursive: true });
    }

    // Quitar la extensión .zip de finalFileName
    const baseName = finalFileName.replace(/\.zip$/i, "");
    let counter = 1;
    for (const shot of screenshots) {
      const newName = `scr${String(counter).padStart(2, "0")}_${baseName}${path.extname(shot.filename)}`;
      // Ruta de destino
      const destPath = path.join(scrFolder, newName);
      fs.renameSync(shot.path, destPath);
      screenshotNames.push(newName);
      counter++;
    }

    tempSaveData.file = finalFileName;
    tempSaveData.fileSize = file.size;
    await tempSaveData.save();

    // Actualizar juego y usuario
    await updateGameAfterUpload(gameID, saveID);
    await updateUserAfterUpload(user, saveID);

    await sendNotification({
      userIDs: user.userID,
      type: 5,
      args: { savedata: tempSaveData, game: game.data }
    });

    console.log("Proceso asincrono finalizado sin errores")

  } catch (error) {
    console.error("Error en proceso asíncrono de subida:", error);

    if (user) {
      await sendNotification({
        userIDs: user.userID,
        type: 6
      });
    }
  }
}

router.post('/async', authenticateMW, uploadSaveDataFiles.fields([
  { name: 'file', maxCount: 1 },
  { name: 'screenshots', maxCount: 4 }
]), async (req, res) => {
  try {
    const file = req.files?.file?.[0];
    if (!file) throw new Error('No file uploaded');

    asyncProcessSaveFileUpload(file, req.user, req.body, req.files?.screenshots || []);

    // Responder rápido con éxito y redirigir al inicio en frontend
    return httpResponses.ok(res, { msg: 'Proceso iniciado' });
  } catch (err) {
    // Manejo error normal
    console.error("Error iniciando subida:", err);
    if (req.files?.file?.[0]?.path && fs.existsSync(req.files?.file?.[0]?.path)) {
      fs.unlinkSync(req.files?.file?.[0]?.path);
    }
    if (req.files?.screenshots) {
      for (const shot of req.files.screenshots) {
        if (shot.path && fs.existsSync(shot.path)) {
          fs.unlinkSync(shot.path);
        }
      }
    }
    return httpResponses.badRequest(res, err.message || 'No se pudo iniciar la subida');
  }
});
// -------------------------


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
