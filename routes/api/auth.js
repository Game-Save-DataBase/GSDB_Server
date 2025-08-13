const express = require('express');
const passport = require('passport');
const { Users: User } = require('../../models/Users');
const zxcvbn = require('zxcvbn');
const httpResponses = require('../../utils/httpResponses');

const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  try {
    console.log("REQ.ISAUTH de la funcion register:")
    console.log(req.isAuthenticated())
    if (req.isAuthenticated()) {
      return httpResponses.badRequest(res, 'Already logged in. Log out to register a new user.');
    }

    const { userName, mail, password } = req.body;
    const cleanMail = mail.trim().toLowerCase();
    const cleanUserName = userName.trim().toLowerCase();

    const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!mailRegex.test(cleanMail)) {
      return httpResponses.badRequest(res, 'Invalid email address.');
    }

    const userNameRegex = /^[a-z0-9_]{4,25}$/;
    if (!userNameRegex.test(cleanUserName)) {
      return httpResponses.badRequest(
        res,
        'Username must be lowercase, between 4 and 25 characters, and contain only letters, numbers, or underscores.'
      );
    }

    const passwordStrength = zxcvbn(password);
    if (passwordStrength.score < 3) {
      return httpResponses.badRequest(res, 'Password is too weak.', {
        warning: passwordStrength.feedback.warning,
        suggestions: passwordStrength.feedback.suggestions,
      });
    }

    try {
      const existingUser = await User.findOne({
        $or: [{ mail: cleanMail }, { userName: cleanUserName }],
      });
      if (existingUser) {
        return httpResponses.badRequest(res, 'Username or email is already in use.');
      }

      const user = new User({ userName: cleanUserName, mail: cleanMail, password });
      await user.save();

      return httpResponses.created(res, 'User successfully registered.');
    } catch (err) {
      if (err.code === 11000) {
        if (err.message.includes('userName')) {
          return httpResponses.badRequest(res, 'Username is already taken.');
        }
        if (err.message.includes('mail')) {
          return httpResponses.badRequest(res, 'Email is already in use.');
        }
      }
      return httpResponses.internalError(res, 'Server error.', err.message);
    }
  } catch (err) {
    console.error(err)
  }

});

// User login
router.post('/login', (req, res, next) => {
  try {
    console.log("REQ.ISAUTH de la funcion login:")
    console.log(req.isAuthenticated())
    if (req.isAuthenticated()) {
      return httpResponses.badRequest(res, 'Already authenticated. Log out to switch accounts.');
    }
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) return httpResponses.badRequest(res, info.message);

      req.logIn(user, err => {
        if (err) return next(err);
        return httpResponses.ok(res, { msg: 'Login successful.', user });
      });
    })(req, res, next);

  } catch (err) {
    console.error(err)
  }
});

// User logout
router.get('/logout', (req, res) => {
  try {
    console.log("REQ.ISAUTH de la funcion logout:")
    console.log(req.isAuthenticated())
    if (!req.isAuthenticated()) {
      return httpResponses.unauthorized(res, 'No active session.');
    }
    req.logout(err => {
      if (err) return httpResponses.internalError(res, 'Logout error.', err.message);
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return httpResponses.ok(res, 'Session successfully closed.');
      });
    });
  } catch (err) {
    console.error(err)
  }

});

// Check if user is authenticated
router.get('/me', (req, res) => {
  try {
    console.log("REQ.ISAUTH de la funcion me:")
    console.log(req.isAuthenticated())
    if (req.isAuthenticated()) {
      return httpResponses.ok(res, { user: req.user });
    }
    return httpResponses.unauthorized(res, 'Not authenticated.');

  } catch (err) {
    console.error(err)
  }
});

module.exports = router;
