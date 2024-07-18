// routes/api/platforms.js

const express = require('express');
const router = express.Router();

// Load platform model
const Platforms = require('../../models/platforms');

// @route   GET api/platforms/test
// @desc    Tests platforms route
// @access  Public
router.get('/test', (req, res) => res.send('platform route testing!'));

// @route   GET api/platforms
// @desc    Get all platforms
// @access  Public
router.get('/', (req, res) => {
  Platforms.find()
    .then(platforms => res.json(platforms))
    .catch(err => res.status(404).json({ noplatformsfound: 'No platforms found' }));
});

// @route   GET api/platforms/:id
// @desc    Get single platform by id
// @access  Public
router.get('/:id', (req, res) => {
  Platforms.findById(req.params.id)
    .then(platform => res.json(platform))
    .catch(err => res.status(404).json({ noplatformfound: 'No platform found' }));
});

// @route   POST api/platforms
// @desc    Add/save platform
// @access  Public
router.post('/', (req, res) => {
  Platforms.create(req.body)
    .then(platform => res.json({ msg: 'platform added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this platform' }));
});

// @route   PUT api/platforms/:id
// @desc    Update platform by id
// @access  Public
router.put('/:id', (req, res) => {
  Platforms.findByIdAndUpdate(req.params.id, req.body)
    .then(platform => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/platforms/:id
// @desc    Delete platform by id
// @access  Public
router.delete('/:id', (req, res) => {
  Platforms.findByIdAndDelete(req.params.id)
    .then(platform => res.json({ mgs: 'platform entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a platform' }));
});

module.exports = router;