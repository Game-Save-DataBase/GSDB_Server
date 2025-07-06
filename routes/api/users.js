const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { Users } = require('../../models/Users');
const { hasStaticFields } = require('../../models/modelRegistry');
const httpResponses = require('../../utils/httpResponses');
const bcrypt = require('bcryptjs');
const { uploadUserImage } = require('../../config/multer');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../../utils/config');

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


// POST /favorite-game-toggle
router.post('/favorite-game-toggle', authenticateMW, async (req, res) => {
  try {

    const { gameID, action } = req.body; // action: 'favorite' | 'unfavorite'
    if (gameID === undefined || gameID === null) return httpResponses.badRequest(res, 'Missing gameID');
    if (!['favorite', 'unfavorite'].includes(action)) {
      return httpResponses.badRequest(res, 'Invalid action, must be "favorite" or "unfavorite"');
    }
    const loggedUser = req.user;

    const gameIDNum = Number(gameID);
    if (isNaN(gameIDNum)) {
      return httpResponses.badRequest(res, 'gameID must be a valid number');
    }

    const alreadyFavorite = loggedUser.favGames.includes(gameIDNum);

    if (action === 'favorite') {
      if (alreadyFavorite) {
        return httpResponses.ok(res, { message: 'Game already in favorites' });
      }
      loggedUser.favGames.push(gameIDNum);

    } else if (action === 'unfavorite') {
      if (!alreadyFavorite) {
        return httpResponses.ok(res, { message: 'Game not in favorites' });
      }
      loggedUser.favGames = loggedUser.favGames.filter(id => id !== gameIDNum);
    }

    await loggedUser.save();

    return httpResponses.ok(res, { message: `Game ${action}d successfully` });

  } catch (err) {
    return httpResponses.internalError(res, `Error trying to ${req.body.action || 'favorite/unfavorite'} game`);
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
      const userFolder = path.join(__dirname, '../', config.paths.userProfiles, loggedUser.id);
      try {
        await fs.rm(userFolder, { recursive: true, force: true });
      } catch (fsErr) {
        console.error(`Error deleting user folder after failure: ${fsErr.message}`);
      }
      return httpResponses.badRequest(res, errmes);

    }
    return httpResponses.ok(res, { message: 'Image uploaded successfully', imageUrl: imagePath });
  });
});



// PUT api/users
router.put('/', authenticateMW, async (req, res) => {
  try {
    const user = req.user;

    if (hasStaticFields(req.body)) {
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

    // Buscar usuario a borrar con findByID
    const deleted = await findByID({ id }, 'user');
    if (!deleted) return httpResponses.notFound(res, 'User not found');

    await deleted.remove();

    const userPath = path.join(usersRoot, deleted.id.toString());

    try {
      await fs.rm(userPath, { recursive: true, force: true });
    } catch (fsErr) {
      console.error(`Error deleting folder for user ${deleted.id}:`, fsErr);
    }

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

    try {
      const folders = await fs.readdir(usersRoot, { withFileTypes: true });
      const deletions = folders
        .filter(dirent => dirent.isDirectory())
        .map(dirent => fs.rm(path.join(usersRoot, dirent.name), { recursive: true, force: true }));

      await Promise.all(deletions);
    } catch (fsErr) {
      console.error('Error deleting users folders:', fsErr);
    }

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

// POST /add-notification
// Añade notificaciones en el usuario logado
router.post('/add-notification', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { type, title, body, link } = req.body;

    if (typeof type !== 'number' || !title || !body) {
      return httpResponses.badRequest(res, 'Missing or invalid fields: type (number), title, body required');
    }

    // Comprobación de duplicados
    const alreadyExists = loggedUser.notifications.some((n) =>
      n.type === type &&
      n.title === title &&
      n.body === body &&
      (link ? n.link === link : true)
    );

    if (alreadyExists) {
      return httpResponses.conflict(res, 'Duplicate notification already exists');
    }


    const notification = {
      _id: new mongoose.Types.ObjectId(),
      type,
      title,
      body,
      read: false,
      createdAt: new Date(),
      link: link || null
    };

    loggedUser.notifications.push(notification);
    await loggedUser.save();

    return httpResponses.ok(res, { message: 'Notification added', notification });
  } catch (err) {
    console.error('Error in /add-notification:', err);
    return httpResponses.internalError(res, 'Error adding notification');
  }
});

// POST /send-notification
// Envía una notifiación al usuario indicado
router.post('/send-notification', authenticateMW, async (req, res) => {
  try {
    const { toUserId, type, title, body, link } = req.body;

    if (!toUserId || typeof type !== 'number' || !title || !body) {
      return httpResponses.badRequest(res, 'Missing or invalid fields');
    }
    const toUser = await Users.findById(toUserId);
    if (!toUser) return httpResponses.notFound(res, 'User not found');

    const notification = {
      _id: new mongoose.Types.ObjectId(),
      type,
      title,
      body,
      read: false,
      createdAt: new Date(),
      link: link || null
    };

    toUser.notifications.push(notification);
    await toUser.save();

    return httpResponses.ok(res, { message: 'Notification sent', notification });
  } catch (err) {
    console.error('Error in /send-notification:', err);
    return httpResponses.internalError(res, 'Error sending notification');
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
