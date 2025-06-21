const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/queryUtils');
const bcrypt = require('bcryptjs');
const { uploadUserImage } = require('../../config/multer');
const { Users, filterFields } = require('../../models/Users');
const httpResponses = require('../../utils/httpResponses');
const fs = require('fs/promises');
const path = require('path');


// Ruta de test, dev mode
router.get('/test', blockIfNotDev, (req, res) => res.send('user route testing!'));

// GET api/users
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    if (query._id) {
      const u = await Users.findById(query._id);
      if (!u) return httpResponses.notFound(res, `User with id ${query._id} not found`);
      return httpResponses.ok(res, u);
    }

    const filter = buildMongoFilter(query, filterFields);
    const u_response = await Users.find(filter);

    // NO devolver 404 si no hay coincidencias, devolver array vacío 200
    if (u_response.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    // Si es un solo resultado devolver objeto, sino array
    return httpResponses.ok(res, u_response.length === 1 ? u_response[0] : u_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error');
  }
});

// POST api/users/by-id
router.post('/by-id', async (req, res) => {
  try {
    const query = req.query;
    const ids = (req.body.ids || []).filter(Boolean);
    const userNames = (req.body.userNames || []).filter(Boolean);

    if (!ids.length && !userNames.length) {
      return httpResponses.badRequest(res, 'Must provide ids or userNames');
    }

    let mongoFilter = { $or: [{ _id: { $in: ids } }, { userName: { $in: userNames } }] };

    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      mongoFilter = { ...mongoFilter, ...additionalFilter };
    }

    const users = await Users.find(mongoFilter);
    if(users.lenght === 0) return httpResponses.noContent(res, 'No coincidences');
    return httpResponses.ok(res, users.length === 1 ? users[0] : users);
  } catch (error) {
    return httpResponses.internalError(res, 'Error fetching users');
  }
});

// POST api/users - crear usuario
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
    const loggedUser = req.user;

    if (!loggedUser) return httpResponses.unauthorized(res, 'Not logged in');
    if (!password) return httpResponses.badRequest(res, 'Password is required');

    const isValid = await bcrypt.compare(password, loggedUser.password);
    return httpResponses.ok(res, { valid: isValid });
  } catch (err) {
    return httpResponses.internalError(res, 'Error verifying password');
  }
});

// POST /follow
router.post('/follow', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { toFollow } = req.body;

    if (!loggedUser) return httpResponses.badRequest(res, 'Not logged in');
    if (!toFollow) return httpResponses.badRequest(res, 'Invalid parameters');

    const userToFollow = await Users.findById(toFollow);
    if (!userToFollow) return httpResponses.notFound(res, `User with id ${toFollow} not found`);

    if (loggedUser._id.toString() === userToFollow._id.toString()) {
      return httpResponses.badRequest(res, 'Cannot follow yourself');
    }

    const alreadyFollowing = loggedUser.following.includes(userToFollow._id);
    if (alreadyFollowing) {
      return httpResponses.ok(res, { message: 'Already following user' });
    }

    loggedUser.following.push(userToFollow._id);
    userToFollow.followers.push(loggedUser._id);

    await loggedUser.save();
    await userToFollow.save();

    return httpResponses.ok(res, { message: 'User followed correctly' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error following user');
  }
});

// POST /unfollow
router.post('/unfollow', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { toUnfollow } = req.body;

    if (!loggedUser) return httpResponses.badRequest(res, 'Not logged in');
    if (!toUnfollow) return httpResponses.badRequest(res, 'Invalid parameters');

    const userToUnfollow = await Users.findById(toUnfollow);
    if (!userToUnfollow) return httpResponses.notFound(res, `User with id ${toUnfollow} not found`);

    if (loggedUser._id.toString() === userToUnfollow._id.toString()) {
      return httpResponses.badRequest(res, 'Cannot unfollow yourself');
    }

    const isFollowing = loggedUser.following.some(followingId => followingId.toString() === userToUnfollow._id.toString());
    if (!isFollowing) {
      return httpResponses.ok(res, { message: 'You are not following this user' });
    }

    loggedUser.following = loggedUser.following.filter(followingId => followingId.toString() !== userToUnfollow._id.toString());
    userToUnfollow.followers = userToUnfollow.followers.filter(followerId => followerId.toString() !== loggedUser._id.toString());

    await loggedUser.save();
    await userToUnfollow.save();

    return httpResponses.ok(res, { message: 'User unfollowed correctly' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error unfollowing user');
  }
});

// POST /favorite-game
router.post('/favorite-game', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { gameID } = req.body;

    if (!loggedUser) return httpResponses.unauthorized(res, 'Not logged in');
    if (!gameID) return httpResponses.badRequest(res, 'Missing gameID');

    const alreadyFavorite = loggedUser.favGames.includes(gameID);
    if (alreadyFavorite) {
      return httpResponses.ok(res, { message: 'Game already in favorites' });
    }

    loggedUser.favGames.push(gameID);
    await loggedUser.save();

    return httpResponses.ok(res, { message: 'Game added to favorites' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error adding favorite game');
  }
});

router.post('/unfavorite-game', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { gameID } = req.body;

    if (!loggedUser) return httpResponses.unauthorized(res, 'Not logged in');
    if (!gameID) return httpResponses.badRequest(res, 'Missing gameID');

    const index = loggedUser.favGames.indexOf(gameID);
    if (index === -1) {
      return httpResponses.ok(res, { message: 'Game not in favorites' });
    }

    loggedUser.favGames.splice(index, 1); // elimina el gameId
    await loggedUser.save();

    return httpResponses.ok(res, { message: 'Game removed from favorites' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error removing favorite game');
  }
});


// POST /:userId/upload/:type
router.post('/:userId/upload/:type', authenticateMW, uploadUserImage.single('image'), async (req, res) => {
  const { userId, type } = req.params;

  if (!req.file) return httpResponses.badRequest(res, 'No file uploaded');
  if (!['pfp', 'banner'].includes(type)) return httpResponses.badRequest(res, 'Invalid image type');

  try {
    const user = await Users.findById(userId);
    if (!user) return httpResponses.notFound(res, 'User not found');

    const imagePath = `/assets/users/${userId}/${req.file.filename}`;
    if (type === 'pfp') user.pfp = imagePath;
    else if (type === 'banner') user.banner = imagePath;

    await user.save();
    return httpResponses.ok(res, { message: 'Image uploaded successfully', imageUrl: imagePath });
  } catch (err) {
    return httpResponses.internalError(res, 'Server error while saving image path');
  }
});

// PUT /:id actualizar usuario
router.put('/:id', authenticateMW, async (req, res) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return httpResponses.notFound(res, 'User not found');

    Object.keys(req.body).forEach(key => { user[key] = req.body[key]; });

    const MAX_LINES = 5;
    const MAX_BIO_LENGTH = 500;

    if (typeof req.body.bio === 'string') {
      const lineCount = req.body.bio.split('\n').length;
      if (lineCount > MAX_LINES) {
        return httpResponses.badRequest(res, `Bio must have no more than ${MAX_LINES} lines`);
      }
      if (req.body.bio.length > MAX_BIO_LENGTH) {
        return httpResponses.badRequest(res, `Bio must be shorter than ${MAX_BIO_LENGTH} characters`);
      }
      req.body.bio = req.body.bio.split('\n').map(line => line.trim()).join('\n').trim();
    }

    await user.save();
    return httpResponses.ok(res, { message: 'Updated successfully', user });
  } catch (err) {
    return httpResponses.badRequest(res, `Unable to update the user: ${err.message}`);
  }
});

// DELETE /:id eliminar usuario
router.delete('/:id', blockIfNotDev, async (req, res) => {
  try {
    const deleted = await Users.findByIdAndDelete(req.params.id);
    if (!deleted) return httpResponses.notFound(res, 'User not found');

    const userFolderPath = path.join(__dirname, '..', '..', 'users', req.params.id);
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
    const resultado = await Users.deleteMany({});

    const uploadsPath = path.join(__dirname, '..', '..', 'assets', 'users');
    try {
      const folders = await fs.readdir(uploadsPath, { withFileTypes: true });
      const folderDeletions = folders
        .filter(dirent => dirent.isDirectory())
        .map(dirent => fs.rm(path.join(uploadsPath, dirent.name), { recursive: true, force: true }));
      await Promise.all(folderDeletions);
    } catch (fsErr) {
      console.error('Error deleting user folders:', fsErr);
    }

    return httpResponses.ok(res, { deletedCount: uploadsPath });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping users');
  }
});


module.exports = router;
