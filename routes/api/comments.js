// routes/api/comments.js

const express = require('express');
const router = express.Router();

// Load comment model
const Comment = require('../../models/comments');

// @route   GET api/comments/test
// @desc    Tests comments route
// @access  Public
router.get('/test', (req, res) => res.send('comment route testing!'));

// @route   GET api/comments
// @desc    Get all comments
// @access  Public
router.get('/', (req, res) => {
  Comment.find()
    .then(comments => res.json(comments))
    .catch(err => res.status(404).json({ nocommentsfound: 'No comments found' }));
});

// @route   GET api/comments/:id
// @desc    Get single comment by id
// @access  Public
router.get('/:id', (req, res) => {
  Comment.findById(req.params.id)
    .then(comment => res.json(comment))
    .catch(err => res.status(404).json({ nocommentfound: 'No comment found' }));
});

// @route   POST api/comments
// @desc    Add/save comment
// @access  Public
router.post('/', (req, res) => {
  Comment.create(req.body)
    .then(comment => res.json({ msg: 'comment added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this comment' }));
});

// @route   PUT api/comments/:id
// @desc    Update comment by id
// @access  Public
router.put('/:id', (req, res) => {
  Comment.findByIdAndUpdate(req.params.id, req.body)
    .then(comment => res.json({ msg: 'Updated successfully' }))
    .catch(err =>
      res.status(400).json({ error: 'Unable to update the Database' })
    );
});

// @route   DELETE api/comments/:id
// @desc    Delete comment by id
// @access  Public
router.delete('/:id', (req, res) => {
  Comment.findByIdAndDelete(req.params.id)
    .then(comment => res.json({ mgs: 'comment entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a comment' }));
});

module.exports = router;