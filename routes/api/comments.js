// routes/api/comments.js

const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode
const { buildMongoFilter } = require('../../utils/mongoutils');
// Load comment model
const { Comments, filterFields } = require('../../models/Comments');

/**
 * @route GET api/comments/test
 * @desc  testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => res.send('comment route testing!'));


/**
 * @route GET api/comments
 * @params see models/comments
 * @desc get all coincidences that matches with query filters. It supports mongodb operands
 *        using no filter returns all coincidences
 * @access public TO DO el uso del id de la base de datos no deberia ser publico para todo el mundo. Quizas deberiamos crear un id propio
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;
    //buscamos primero con el id de mongodb, si no, comenzamos a filtrar
    if (query._id) {
      const comment = await Comments.findById(query._id);
      if (!comment) return res.status(404).json({ msg: `Comment with id ${query._id} not found` });
      return res.json(comment);
    }
    const filter = buildMongoFilter(query, filterFields);

    const comments_response = await Comments.find(filter);

    if (comments_response.length === 0) {
      return res.status(404).json({ msg: 'No coincidences' });
    }
    if(comments_response.length===1){
      return res.json(comments_response[0]);
    }
    return res.json(comments_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST api/comments/by-id
 * @body ids = [String] :mongodb _id
 * @params see models/comments
 * @desc Get all comments that matches with id. It supports query params with mongodb operands
 * @access public TO DO no deberia ser accesible para todo el mundo ya que usa los id de la base de datos. Quizas deberiamos usar un id propio
 */
router.post('/by-id', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
      return res.json(); // Devuelve un array vacio (a diferencia del get general)
    }
    const query = req.query;

    let mongoFilter = { _id: { $in: ids } };


    // Añadir filtros si hay parámetros en la query
    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }
    const comments_response = await Comments.find(mongoFilter);
    if(comments_response.length===1){
      return res.json(comments_response[0]);
    }
    return res.json(comments_response);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching comments by ids', error });
  }
});




/**
 * @route POST api/comments/
 * @desc Create comment
 * @body see models/comments.js
 * @access auth 
 */
router.post('/', authenticateMW, (req, res) => {
  Comments.create(req.body)
    .then(comment => res.json({ msg: 'comment added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this comment' }));
});

// @route   PUT api/comments/:id
// @desc    Update comment by id
// @access  Public
router.put('/:id', authenticateMW, (req, res) => {
  Comments.findByIdAndUpdate(req.params.id, req.body)
    .then(comment => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/comments/:id
// @desc    Delete comment by id
// @access  Public
router.delete('/:id', authenticateMW, (req, res) => {
  Comments.findByIdAndDelete(req.params.id)
    .then(comment => res.json({ mgs: 'comment entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a comment' }));
});

module.exports = router;