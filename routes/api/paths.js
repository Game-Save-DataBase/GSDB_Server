// routes/api/paths.js

const express = require('express');
const router = express.Router();

// Load path model
const Paths = require('../../models/paths');

// @route   GET api/paths/test
// @desc    Tests paths route
// @access  Public
router.get('/test', (req, res) => res.send('path route testing!'));

// @route   GET api/paths
// @desc    Get all paths
// @access  Public
router.get('/', (req, res) => {
  Paths.find()
    .then(paths => res.json(paths))
    .catch(err => res.status(404).json({ nopathsfound: 'No paths found' }));
});

// @route   GET api/paths/:id
// @desc    Get single path by id
// @access  Public
router.get('/:id', (req, res) => {
  Paths.findById(req.params.id)
    .then(path => res.json(path))
    .catch(err => res.status(404).json({ nopathfound: 'No path found' }));
});

// @route   POST api/paths
// @desc    Add/save path
// @access  Public
router.post('/', (req, res) => {
  Paths.create(req.body)
    .then(path => res.json({ msg: 'path added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this path' }));
});

// @route   PUT api/paths/:id
// @desc    Update path by id
// @access  Public
router.put('/:id', (req, res) => {
  Paths.findByIdAndUpdate(req.params.id, req.body)
    .then(path => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/paths/:id
// @desc    Delete path by id
// @access  Public
router.delete('/:id', (req, res) => {
  Paths.findByIdAndDelete(req.params.id)
    .then(path => res.json({ mgs: 'path entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a path' }));
});

module.exports = router;