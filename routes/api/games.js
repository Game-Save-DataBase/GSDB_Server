// routes/api/games.js

const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
// Load game model
const Game = require('../../models/games');

// @route   GET api/games/test
// @desc    Tests games route
// @access  Public
router.get('/test', (req, res) => res.send('game route testing!'));


// @route   GET api/games
// @desc    Get all games or filter by multiple IDs
// @access  Public
router.get('/', async (req, res) => {
  try {
    const idsParam = req.query.ids;

    if (idsParam) {
      const idsArray = idsParam.split(',').map(id => id.trim());

      const mongoose = require('mongoose');
      const objectIds = idsArray.map(id => new mongoose.Types.ObjectId(id));

      const games = await Game.find({ _id: { $in: objectIds } });

      return res.json(games);
    }

    // Si no hay query param: devolver todos los juegos
    const games = await Game.find();
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching games' });
  }
});

// @route   GET api/games/:id
// @desc    Get single game by id
// @access  Public
router.get('/:id', (req, res) => {
  Game.findById(req.params.id)
    .then(game => res.json(game))
    .catch(err => res.status(404).json({ nogamefound: 'No game found' }));
});
router.use(authenticateMW);

// @route   POST api/games
// @desc    Add/save game
// @access  Public
router.post('/', (req, res) => {
  Game.create(req.body)
    .then(game => res.json({ msg: 'game added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this game' }));
});

// @route   PUT api/games/:id
// @desc    Update game by id
// @access  Public
router.put('/:id', (req, res) => {
  Game.findByIdAndUpdate(req.params.id, req.body)
    .then(game => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/games/:id
// @desc    Delete game by id
// @access  Public
router.delete('/:id', (req, res) => {
  Game.findByIdAndDelete(req.params.id)
    .then(game => res.json({ mgs: 'game entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a game' }));
});

module.exports = router;