// routes/api/users.js

const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW'); // <== middleware
const blockIfNotDev = require('../../middleware/devModeMW'); // middleware de devmode

// Load user model
const User = require('../../models/Users');

// @route   GET api/users/test
// @desc    Tests users route
// @access  Public
router.get('/test', blockIfNotDev, (req, res) => res.send('user route testing!'));



// @route   GET api/users
// @desc    Get all users
// @access  Public
router.get('/', authenticateMW, (req, res) => {
  User.find()
    .then(users => res.json(users))
    .catch(err => res.status(404).json({ nousersfound: 'No users found' }));
});

// @route   GET api/users/:id
// @desc    Get single user by id
// @access  Public
router.get('/:id', (req, res) => {
  User.findById(req.params.id)
    .then(user => res.json(user))
    .catch(err => res.status(404).json({ nouserfound: 'No user found' }));
});
// @route   GET api/users/by-username/:userName
// @desc    Get single user by username
// @access  Public
router.get('/by-username/:userName', (req, res) => {
  User.findOne({ userName: new RegExp(`^${req.params.userName}$`, 'i') }) //esto es lo mismo que hacer toLowerCase() pero con un regex
    .then(user => {
      if (!user) {
        return res.status(404).json({ nouserfound: 'No user found' });
      }
      res.json(user);
    })
    .catch(err =>
      res.status(500).json({ error: 'Database error retrieving user' })
    );
});

// @route   POST api/users
// @desc    Add/save user
// @access  Public
router.post('/', blockIfNotDev, (req, res) => {
  User.create(req.body)
    .then(user => res.json({ msg: 'user added successfully' }))
    .catch(err => res.status(400).json({ error: 'Unable to add this user' }));
});

// @route   PUT api/users/:id
// @desc    Update user by id
// @access  Public
router.put('/:id', blockIfNotDev, async (req, res) => {
  //usamos save en lugar de findbyidandupdate porque no se ejecutaria bien la encriptacion
  try {
    const user = await User.findById(req.params.id);
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
  User.findByIdAndDelete(req.params.id)
    .then(user => res.json({ mgs: 'user entry deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such a user' }));
});

module.exports = router;