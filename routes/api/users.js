// routes/api/users.js

const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode
const { buildMongoFilter } = require('../../utils/mongoutils');

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
    if(u_response.length === 1){
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
    const { ids, userNames } = req.body;
    if ((!ids || ids.length === 0) && (!userNames || userNames.lenght===0)) {
      return res.json(); // Devuelve un array vacio (a diferencia del get general)
    }
    const query = req.query;

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
    if(u_response.length === 1){
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
router.post('/', blockIfNotDev, (req, res) => {
  Users.create(req.body)
    .then(user => res.json({ msg: 'user added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this user' }));
});

// @route   PUT api/users/:id
// @desc    Update user by id
// @access  Public
router.put('/:id', blockIfNotDev, async (req, res) => {
  //usamos save en lugar de findbyidandupdate porque no se ejecutaria bien la encriptacion
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Actualizamos manualmente los campos
    Object.keys(req.body).forEach((key) => {
      user[key] = req.body[key];
    });
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