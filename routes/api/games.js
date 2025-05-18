// routes/api/games.js

const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode
const { buildMongoFilter } = require('../../utils/mongoutils');
// Load game model
const { Games, filterFields } = require('../../models/games');

/**
 * @route GET api/comments/test
 * @desc  testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => res.send('game route testing!'));


/**
 * @route GET api/games
 * @params see models/games
 * @desc get all coincidences that matches with query filters. It supports mongodb operands
 *        using no filter returns all coincidences
 * @access public TO DO el uso del id de la base de datos no deberia ser publico para todo el mundo. Quizas deberiamos crear un id propio
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;
    //buscamos primero con el id de mongodb, si no, comenzamos a filtrar
    if (query._id) {
      const game = await Games.findById(query._id);
      if (!game) return res.status(404).json({ msg: `Game with id ${query._id} not found` });
      return res.json(game);
    }
    const filter = buildMongoFilter(query, filterFields);

    const games_response = await Games.find(filter);

    if (games_response.length === 0) {
      return res.status(404).json({ msg: 'No coincidences' });
    }
    if (games_response.length === 1) {
      return res.json(games_response[0]);
    }
    return res.json(games_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});


/**
 * @route POST api/games/by-id
 * @body ids = [String] :mongodb _id
 * @params see models/games
 * @desc Get all games that matches with id or platformID. It supports query params with mongodb operands
 * @access public TO DO no deberia ser accesible para todo el mundo ya que usa los id de la base de datos. Quizas deberiamos usar un id propio
 */
router.post('/by-id', async (req, res) => {
  try {
    const query = req.query;
    // Limpiamos arrays: quitamos elementos falsy (como "")
    let ids = (req.body.ids || [])
    let platformsID = (req.body.platformsID || [])
    if (!Array.isArray(ids)) {
      ids = [ids];  // Si es string, lo convierte en array con un elemento
    }
    if (!Array.isArray(platformsID)) {
      platformsID = [platformsID];  // Si es string, lo convierte en array con un elemento
    }
    ids = ids.filter(id => !!id);
    platformsID = platformsID.filter(p => !!p);
    if ((ids && ids.length === 0) && (platformsID && platformsID.length === 0)) {
      return res.json([]); // Devuelve un array vacío si alguno está definido y vacío
    }

    let mongoFilter = {
      $or: [
        { _id: { $in: ids } },
        { platformsID: { $in: platformsID } }
      ]
    };

    // Añadir filtros si hay parámetros en la query
    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }
    const games_response = await Games.find(mongoFilter);
    if (games_response.length === 1) {
      return res.json(games_response);
    }
    return res.json(games_response);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching games by ids or platform ids', error });
  }
});


// @route   POST api/games
// @desc    Add/save game
// @access  Public
router.post('/', authenticateMW, (req, res) => {
  Games.create(req.body)
    .then(game => res.json({ msg: 'game added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this game' }));
});

// @route   PUT api/games/:id
// @desc    Update game by id
// @access  Public
router.put('/:id', blockIfNotDev, authenticateMW, (req, res) => {
  Games.findByIdAndUpdate(req.params.id, req.body)
    .then(game => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/games/:id
// @desc    Delete game by id
// @access  Public
router.delete('/:id', blockIfNotDev, authenticateMW, (req, res) => {
  Games.findByIdAndDelete(req.params.id)
    .then(game => res.json({ mgs: 'game entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a game' }));
});

module.exports = router;