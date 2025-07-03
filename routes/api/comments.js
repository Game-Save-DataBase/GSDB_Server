const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/queryUtils');
const { Comments } = require('../../models/Comments');
const { hasStaticFields } = require('../../models/modelRegistry');
const httpResponses = require('../../utils/httpResponses');
/**
 * @route GET api/comments/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'comment route testing!'));


/**
 * @route GET api/comments
 * @desc get and filter by query
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;
    const fastResult = await findByID(query, 'comment');

    if (fastResult !== undefined) {
      if (!fastResult) {
        return httpResponses.noContent(res, 'No coincidences');
      }
      return httpResponses.ok(res, fastResult);
    }

    const results = await findByQuery(query, 'comment');
    if (results.length === 0) return httpResponses.noContent(res, 'No coincidences');
    return httpResponses.ok(res, results.length === 1 ? results[0] : results);

  }
  catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
  }
});


/**
 * @route POST api/comments/
 * @desc Create comment
 * @access auth
 */
router.post('/', authenticateMW, async (req, res) => {
  try {
    const comment = await Comments.create(req.body);
    return httpResponses.created(res, 'Comment added successfully', comment);
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to add this comment', err.message);
  }
});

/**
 * @route PUT api/comments/
 * @desc Update comment by id
 * @access auth
 */
router.put('/', authenticateMW, async (req, res) => {
  const { id } = req.query;

  if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');
  if (hasStaticFields(req.body)) {
    return httpResponses.badRequest(res, 'Body contains invalid or non existent fields to update');
  }

  try {
    // Pasamos la query completa para que findByID la analice
    const updated = await findByID(req.query, 'comment');
    if (!updated) return httpResponses.notFound(res, 'Comment not found');

    Object.assign(updated, req.body);
    await updated.save();

    return httpResponses.ok(res, { message: 'Updated successfully', comment: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the comment', err.message);
  }
});

/**
 * @route DELETE api/comments/
 * @desc Delete comment by id
 * @access auth
 */
router.delete('/', authenticateMW, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return httpResponses.badRequest(res, 'Missing "id" in query');
  }
  try {
    // Pasamos la query completa para que findByID la analice
    const comment = await findByID(req.query, 'comment');
    if (!comment) {
      return httpResponses.notFound(res, 'Comment not found');
    }

    await comment.remove();

    return httpResponses.ok(res, { message: 'Comment entry deleted successfully' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error deleting comment', err.message);
  }
});


/**
 * @route DELETE api/comments/dev/wipe
 * @desc wipe all comments (dev only)
 * @access dev mode only
 */
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await Comments.deleteMany({});
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping comments', err.message);
  }
});

module.exports = router;
