const express = require('express');
const router = express.Router();
const { authenticateMW } = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { Users } = require('../../models/Users');
const { Games } = require('../../models/Games');
const { hasStaticFields } = require('../../models/modelRegistry');
const httpResponses = require('../../utils/httpResponses');
const bcrypt = require('bcryptjs');
const { uploadUserImage } = require('../../config/multer');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../../utils/config');
const axios = require('axios');
const notificationTemplates = require('../../utils/notificationTemplates');
const { SaveDatas } = require('../../models/SaveDatas');


// Ruta de test, dev mode
router.get('/test', blockIfNotDev, (req, res) => res.send('user route testing!'));

// GET api/users
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    // Intentar búsqueda rápida por id
    const fastResult = await findByID(query, 'user');
    if (fastResult !== undefined) {
      if (!fastResult) return httpResponses.noContent(res, 'User not found');
      return httpResponses.ok(res, fastResult);
    }

    // Si no es búsqueda rápida, hacer búsqueda por query completo
    const results = await findByQuery(query, 'user');
    if (results.length === 0) return httpResponses.noContent(res, 'No coincidences');
    return httpResponses.ok(res, results.length === 1 ? results[0] : results);

  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
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
        alias: { like: searchValue, __or: true },
        userName: { like: searchValue, __or: true },
        bio: { like: searchValue, __or: true }
      };
    } else {
      query = {
        userName: { like: searchValue }
      }
    }

    if (limit) query.limit = limit;
    if (offset) query.offset = offset;
    if (!fast) {
      if (req.query.admin) query.admin = req.query.admin;
      if (req.query.trusted) query.trusted = req.query.trusted;
      if (req.query.verified) query.verified = req.query.verified;
      if (req.query.rating) query.rating = req.query.rating;
    }

    const data = await findByQuery(query, 'user');
    if (!Array.isArray(data) || data.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    const normalizedQuery = searchValue.trim().toLowerCase();
    const sorted = data.sort((a, b) => {
      const aUserName = (a.userName || "").toLowerCase();
      const bUserName = (b.userName || "").toLowerCase();
      const aAlias = (a.alias || "").toLowerCase();
      const bAlias = (b.alias || "").toLowerCase();

      const aIndexUser = aUserName.indexOf(normalizedQuery);
      const bIndexUser = bUserName.indexOf(normalizedQuery);

      if (aUserName.startsWith(normalizedQuery) && !bUserName.startsWith(normalizedQuery)) return -1;
      if (!aUserName.startsWith(normalizedQuery) && bUserName.startsWith(normalizedQuery)) return 1;
      if (aIndexUser !== bIndexUser) return aIndexUser - bIndexUser;

      // Fallback: alias
      const aIndexAlias = aAlias.indexOf(normalizedQuery);
      const bIndexAlias = bAlias.indexOf(normalizedQuery);

      if (aAlias.startsWith(normalizedQuery) && !bAlias.startsWith(normalizedQuery)) return -1;
      if (!aAlias.startsWith(normalizedQuery) && bAlias.startsWith(normalizedQuery)) return 1;
      if (aIndexAlias !== bIndexAlias) return aIndexAlias - bIndexAlias;

      return aAlias.length - bAlias.length;
    });

    return httpResponses.ok(res, sorted);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, error.message);
  }
});



// POST api/users
router.post('/', async (req, res) => {
  try {
    const user = await Users.create(req.body);
    return httpResponses.created(res, { message: 'User created successfully', user });
  } catch (err) {
    return httpResponses.badRequest(res, `Unable to create user: ${err.message}`);
  }
});

// POST /verify-password
router.post('/verify-password', authenticateMW, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return httpResponses.badRequest(res, 'Password is required');
    const loggedUser = req.user;

    const isValid = await bcrypt.compare(password, loggedUser.password);
    return httpResponses.ok(res, { valid: isValid });
  } catch (err) {
    return httpResponses.internalError(res, 'Error verifying password');
  }
});


// POST /follow-toggle
router.post('/follow-toggle', authenticateMW, async (req, res) => {
  try {
    const { targetId, action } = req.body; // action: 'follow' | 'unfollow'
    if (!targetId || !action) return httpResponses.badRequest(res, 'Invalid parameters');
    if (!['follow', 'unfollow'].includes(action)) {
      return httpResponses.badRequest(res, 'Invalid action, must be "follow" or "unfollow"');
    }

    const loggedUser = req.user;

    // Buscar usuario a modificar con findByID
    const userToModify = await findByID({ id: targetId }, 'user');
    if (!userToModify) return httpResponses.notFound(res, `User with id ${targetId} not found`);

    const loggedUserIdNum = loggedUser.userID;
    const targetUserIdNum = userToModify.userID;

    if (loggedUserIdNum === targetUserIdNum) {
      return httpResponses.badRequest(res, `Cannot ${action} yourself`);
    }

    const isFollowing = loggedUser.following.includes(targetUserIdNum);

    if (action === 'follow') {
      if (isFollowing) return httpResponses.ok(res, { message: 'Already following user' });
      loggedUser.following.push(targetUserIdNum);
      userToModify.followers.push(loggedUserIdNum);
    } else if (action === 'unfollow') {
      if (!isFollowing) return httpResponses.ok(res, { message: 'You are not following this user' });
      loggedUser.following = loggedUser.following.filter(id => id !== targetUserIdNum);
      userToModify.followers = userToModify.followers.filter(id => id !== loggedUserIdNum);
    }

    await loggedUser.save();
    await userToModify.save();

    return httpResponses.ok(res, { message: `User ${action}ed correctly` });
  } catch (err) {
    return httpResponses.internalError(res, `Error trying to ${req.body.action || 'follow/unfollow'} user`);
  }
});

router.post('/add-favorite', authenticateMW, async (req, res) => {
  try {
    const { gameID, saveID } = req.body;
    const loggedUser = req.user;

    if (!gameID && !saveID) {
      return httpResponses.badRequest(res, 'Missing gameID or saveID');
    }

    let messages = [];

    if (gameID) {
      const gameIDNum = Number(gameID);
      if (isNaN(gameIDNum)) {
        return httpResponses.badRequest(res, 'gameID must be a valid number');
      }
      let game = await Games.findOne({ gameID: gameIDNum });
      if (!game) {
        let resPost = await axios.post(`${config.connection}${config.api.games}/igdb`, { IGDB_ID: gameIDNum });
        if (resPost.data.count <= 0) {
          return httpResponses.notFound(res, `Game with gameID ${gameIDNum} or not follow GSDB criteria`);
        }
        game = await Games.findOne({ gameID: gameIDNum });
      }
      if (!loggedUser.favGames.includes(gameIDNum)) {
        loggedUser.favGames.push(gameIDNum);
        if (!game.userFav.includes(loggedUser.userID)) {
          game.userFav.push(loggedUser.userID);
        }
        await game.save();
        messages.push('Game added to favorites successfully');
      } else {
        messages.push('Game already in favorites');
      }
    }

    if (saveID) {
      const saveIDNum = Number(saveID);
      if (isNaN(saveIDNum)) {
        return httpResponses.badRequest(res, 'saveID must be a valid number');
      }
      let save = await SaveDatas.findOne({ saveID: saveIDNum });
      if (!save) {
        return httpResponses.badRequest(res, `Save data with ID ${saveID} does not exist`);
      }
      if (!loggedUser.favSaves.includes(saveIDNum)) {
        loggedUser.favSaves.push(saveIDNum);
        messages.push('Save added to favorites successfully');
      } else {
        messages.push('Save already in favorites');
      }
    }

    await loggedUser.save();

    return httpResponses.ok(res, { message: messages.join(' & ') });
  } catch (err) {
    console.error(err);
    return httpResponses.internalError(res, 'Error adding favorite');
  }
});

// POST /remove-favorite
router.post('/remove-favorite', authenticateMW, async (req, res) => {
  try {
    const { gameID, saveID } = req.body;
    const loggedUser = req.user;

    if (!gameID && !saveID) {
      return httpResponses.badRequest(res, 'Missing gameID or saveID');
    }

    let messages = [];

    if (gameID) {
      const gameIDNum = Number(gameID);
      if (isNaN(gameIDNum)) {
        return httpResponses.badRequest(res, 'gameID must be a valid number');
      }

      const game = await Games.findOne({ gameID: gameIDNum });

      if (loggedUser.favGames.includes(gameIDNum)) {
        loggedUser.favGames = loggedUser.favGames.filter(id => id !== gameIDNum);
        if (game) {
          game.userFav = game.userFav.filter(userId => userId !== loggedUser.userID);
          await game.save();
        }
        messages.push('Game removed from favorites successfully');
      } else {
        messages.push('Game not in favorites');
      }
    }

    if (saveID) {
      const saveIDNum = Number(saveID);
      if (isNaN(saveIDNum)) {
        return httpResponses.badRequest(res, 'saveID must be a valid number');
      }

      if (loggedUser.favSaves.includes(saveIDNum)) {
        loggedUser.favSaves = loggedUser.favSaves.filter(id => id !== saveIDNum);
        messages.push('Save removed from favorites successfully');
      } else {
        messages.push('Save not in favorites');
      }
    }

    await loggedUser.save();

    return httpResponses.ok(res, { message: messages.join(' & ') });
  } catch (err) {
    console.error(err);
    return httpResponses.internalError(res, 'Error removing favorite');
  }
});




router.post('/updateImage', authenticateMW, (req, res) => {
  uploadUserImage.single('image')(req, res, async (err) => {
    if (err) {
      let errmes = err.message
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') { errmes = 'File size limit exceeded'; }
      }
      // En caso de error, borrar carpeta para no dejar huérfanos
      const userFolder = path.join(__dirname, '../', config.paths.userProfiles, loggedUser.userID);
      try {
        await fs.rm(userFolder, { recursive: true, force: true });
      } catch (fsErr) {
        console.error(`Error deleting user folder after failure: ${fsErr.message}`);
      }
      return httpResponses.badRequest(res, errmes);

    }
    return httpResponses.ok(res, { message: 'Image uploaded successfully' });
  });
});



// PUT api/users
router.put('/', authenticateMW, async (req, res) => {
  try {
    const user = req.user;
    if (hasStaticFields(req.body, 'user')) {
      return httpResponses.badRequest(res, 'Body contains invalid or non existent fields to update');
    }
    Object.assign(user, req.body);

    await user.save();

    return httpResponses.ok(res, { message: 'Updated successfully', user });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the user', err.message);
  }
});



const usersRoot = path.join(__dirname, '..', '..', config.paths.userProfiles);

// DELETE api/users
router.delete('/', authenticateMW, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    const deleted = await findByID({ id }, 'user');
    if (!deleted) return httpResponses.notFound(res, 'User not found');

    await deleted.deleteOne(); // Esto ahora también elimina la carpeta

    return httpResponses.ok(res, { message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return httpResponses.internalError(res, 'Error deleting User');
  }
});

// DELETE /dev/wipe
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await Users.deleteMany({});

    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error wiping users:', err);
    return httpResponses.internalError(res, 'Error wiping users');
  }
});




// GET /notifications
// Devuelve todas las notificaciones del usuario logado
router.get('/notifications', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;

    return httpResponses.ok(res, loggedUser.notifications || []);
  } catch (err) {
    return httpResponses.internalError(res, 'Error retrieving notifications');
  }
});


// DELETE /remove-notification/:notificationId
// Borrar una notificacion por id
router.delete('/remove-notification', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;

    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');


    const beforeCount = loggedUser.notifications.length;
    loggedUser.notifications = loggedUser.notifications.filter(n => n._id.toString() !== id);

    if (loggedUser.notifications.length === beforeCount) {
      return httpResponses.notFound(res, 'Notification not found');
    }

    await loggedUser.save();
    return httpResponses.ok(res, { message: 'Notification removed' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error removing notification');
  }
});

// DELETE /wipe-notifications
// Borra todas las notificaciones del usuario logado
router.delete('/wipe-notifications', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    loggedUser.notifications = [];

    await loggedUser.save();
    return httpResponses.ok(res, { message: 'All notifications removed' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error removing all notifications');
  }
});
// PATCH /notification/:notificationId/read
// Cambia el parametro read a true en una notificacion por id del usuario logado
router.patch('/read-notification', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { id } = req.query;
    if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');

    const notification = loggedUser.notifications.find(n => n._id.toString() === id);
    if (!notification) {
      return httpResponses.notFound(res, 'Notification not found');
    }

    notification.read = true;
    await loggedUser.save();

    return httpResponses.ok(res, { message: 'Notification marked as read' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error marking notification as read');
  }
});

// PATCH /read-all-notifications
// Marca todas las notificaciones del usuario logado como leídas
router.patch('/read-all-notifications', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;

    loggedUser.notifications.forEach(notification => {
      notification.read = true;
    });

    await loggedUser.save();
    return httpResponses.ok(res, { message: 'All notifications marked as read' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error marking all notifications as read');
  }
});

module.exports = router;
