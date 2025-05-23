// routes/api/users.js
const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode
const { buildMongoFilter } = require('../../utils/mongoutils');
const bcrypt = require('bcryptjs'); //usamos bcryptjs en lugar de bcrypt porque bcryptjs no tiene dependencias de c++, es todo js.
const { uploadUserImage } = require('../../config/multer');

// Load user model
const { Users, filterFields } = require('../../models/Users');

/**
 * @route GET api/users/test
 * @desc  testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => res.send('user route testing!'));

/**
 * @route GET api/users
 * @params see models/users
 * @desc get all coincidences that matches with query filters. It supports mongodb operands
 *        using no filter returns all coincidences
 * @access public TO DO el uso del id de la base de datos no deberia ser publico para todo el mundo. Quizas deberiamos crear un id propio
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;
    //buscamos primero con el id de mongodb, si no, comenzamos a filtrar
    if (query._id) {
      const u = await Users.findById(query._id);
      if (!u) return res.status(404).json({ msg: `User with id ${query._id} not found` });
      return res.json(u);
    }

    const filter = buildMongoFilter(query, filterFields);

    const u_response = await Users.find(filter);

    if (u_response.length === 0) {
      return res.status(404).json({ msg: 'No coincidences' });
    }
    if (u_response.length === 1) {
      return res.json(u_response[0]);
    }
    return res.json(u_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});


/**
 * @route POST api/users/by-id
 * @body ids = [String] :mongodb _id
 * @params see models/users
 * @desc Get all users that matches with id or username. It supports query params with mongodb operands
 * @access public TO DO no deberia ser accesible para todo el mundo ya que usa los id de la base de datos. Quizas deberiamos usar un id propio
 */
router.post('/by-id', async (req, res) => {
  try {
    const query = req.query;
    // Limpiamos arrays: quitamos elementos falsy (como "")
    const ids = (req.body.ids || []).filter(id => !!id);
    const userNames = (req.body.userNames || []).filter(p => !!p);
    if ((ids && ids.length === 0) || (userNames && userNames.length === 0)) {
      return res.json([]); // Devuelve un array vacío si alguno está definido y vacío
    }

    let mongoFilter = {
      $or: [
        { _id: { $in: ids } },
        { userName: { $in: userNames } }
      ]
    };

    // Añadir filtros si hay parámetros en la query
    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }
    const u_response = await Users.find(mongoFilter);
    if (u_response.length === 1) {
      return res.json(u_response[0]);
    }
    return res.json(u_response);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching user by ids or userNames', error });
  }
});


// @route   POST api/users
// @desc    Add/save user
// @access  Public
router.post('/', (req, res) => {
  Users.create(req.body)
    .then(user => res.json({ msg: 'user added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this user' }));
});


router.post('/verify-password', authenticateMW, async (req, res) => {
  try {
    const { password } = req.body; 
    const loggedUser = req.user;   // usuario autenticado por el middleware

    if (!loggedUser) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const isValid = await bcrypt.compare(password, loggedUser.password);

    res.json({ valid: isValid });
  } catch (err) {
    console.error('Error verifying password:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/follow', authenticateMW, async (req, res) => {
  //cogemos el id que hay en auth, si es el mismo que el usuario que viene en el post, no hacemos nada.
  //si son distintos y ambos existen en base de datos, al usuario que hay en /me le añadimos un following y al usuario del post le añadimos de follower el /me
  try {
    const loggedUser = req.user
    const { toFollow } = req.body;   // usuario al que se quiere seguir

    if (!loggedUser) {
      return res.status(400).json({ message: 'Not logged in' });
    }
    if (!toFollow) {
      return res.status(400).json({ message: 'Invalid parameters' });
    }

    // Verificamos que ambos usuarios existan, osea, volvemos a leerlos
    const [userToFollow] = await Promise.all([
      Users.findById(toFollow)
    ]);

    if (!userToFollow) {
      return res.status(404).json({ message: `User with id ${toFollow} not found` });
    }
    if (loggedUser._id.toString() === userToFollow._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // comprobacion de si ya existe
    const alreadyFollowing = loggedUser.following.includes(userToFollow._id);
    if (alreadyFollowing) {
      return res.status(200).json({ message: 'Already following user' });
    }

    // Añadir IDs a ambos arrays
    loggedUser.following.push(userToFollow._id);
    userToFollow.followers.push(loggedUser._id);

    // Guardamos cambios
    await loggedUser.save();
    await userToFollow.save();

    res.status(200).json({ message: 'User followed correctly' });
  } catch (err) {
    res.status(500).json({ message: 'Error following user ', error: err.message });
  }
});

router.post('/unfollow', authenticateMW, async (req, res) => {
  try {
    const loggedUser = req.user;
    const { toUnfollow } = req.body; // usuario al que se quiere dejar de seguir

    if (!loggedUser) {
      return res.status(400).json({ message: 'Not logged in' });
    }
    if (!toUnfollow) {
      return res.status(400).json({ message: 'Invalid parameters' });
    }

    // Buscamos al usuario a dejar de seguir
    const userToUnfollow = await Users.findById(toUnfollow);
    if (!userToUnfollow) {
      return res.status(404).json({ message: `User with id ${toUnfollow} not found` });
    }

    if (loggedUser._id.toString() === userToUnfollow._id.toString()) {
      return res.status(400).json({ message: 'Cannot unfollow yourself' });
    }

    // Comprobamos si realmente se está siguiendo para poder eliminar
    const isFollowing = loggedUser.following.some(followingId => followingId.toString() === userToUnfollow._id.toString());
    if (!isFollowing) {
      return res.status(200).json({ message: 'You are not following this user' });
    }

    // Quitamos userToUnfollow._id del array following de loggedUser
    loggedUser.following = loggedUser.following.filter(
      followingId => followingId.toString() !== userToUnfollow._id.toString()
    );

    // Quitamos loggedUser._id del array followers de userToUnfollow
    userToUnfollow.followers = userToUnfollow.followers.filter(
      followerId => followerId.toString() !== loggedUser._id.toString()
    );

    // Guardamos cambios
    await loggedUser.save();
    await userToUnfollow.save();

    res.status(200).json({ message: 'User unfollowed correctly' });
  } catch (err) {
    res.status(500).json({ message: 'Error unfollowing user', error: err.message });
  }
});


router.post('/:userId/upload/:type', authenticateMW, uploadUserImage.single('image'), async (req, res) => {
  const { userId, type } = req.params;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!['pfp', 'banner'].includes(type)) return res.status(400).json({ error: 'Invalid image type' });

  try {
    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const imagePath = `/assets/users/${userId}/${req.file.filename}`;
    if (type === 'pfp') user.pfp = imagePath;
    else if (type === 'banner') user.banner = imagePath;

    await user.save();
    res.json({ message: 'Image uploaded successfully', imageUrl: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving image path' });
  }
});

// @route   PUT api/users/:id
// @desc    Update user by id
// @access  Public
router.put('/:id', authenticateMW, async (req, res) => {
  //usamos save en lugar de findbyidandupdate porque no se ejecutaria bien la encriptacion
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Actualizamos manualmente los campos
    Object.keys(req.body).forEach((key) => {
      user[key] = req.body[key];
    });

    const MAX_LINES = 5;
    const MAX_BIO_LENGTH = 500;

    if (typeof req.body.bio === 'string') {
      const lineCount = req.body.bio.split('\n').length;
      if (lineCount > MAX_LINES) {
        return res.status(400).json({ error: `Bio must have no more than ${MAX_LINES} lines` });
      }
      if (req.body.bio.length > MAX_BIO_LENGTH) {
        return res.status(400).json({ error: `Bio must be shorter than ${MAX_BIO_LENGTH} characters` });
      }

      // Limpiar espacios innecesarios
      req.body.bio = req.body.bio
        .split('\n')
        .map(line => line.trim()) // Quita espacios al inicio/final de cada línea
        .join('\n')
        .trim(); // Quita espacios al inicio/final del bloque
    }


    await user.save(); // Aquí sí se ejecuta el pre('save') que usa la encriptacion
    res.json({ msg: 'Updated successfully', user });
  } catch (err) {
    res.status(400).json({ error: 'Unable to update the Database' });
  }
});



// @route   DELETE api/users/:id
// @desc    Delete user by id
// @access  Public
router.delete('/:id', blockIfNotDev, (req, res) => {
  Users.findByIdAndDelete(req.params.id)
    .then(user => res.json({ mgs: 'user entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a user' }));
});

module.exports = router;