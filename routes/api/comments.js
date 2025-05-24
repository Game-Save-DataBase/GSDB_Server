const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/mongoutils');
const { Comments, filterFields } = require('../../models/Comments');
const httpResponses = require('../../utils/httpResponses');

/**
 * @route GET api/comments/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'comment route testing!'));

/**
 * @route GET api/comments
 * @desc get comments matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    if (query._id) {
      const comment = await Comments.findById(query._id);
      if (!comment) return httpResponses.notFound(res, `Comment with id ${query._id} not found`);
      return httpResponses.ok(res, comment);
    }

    const filter = buildMongoFilter(query, filterFields);
    const comments_response = await Comments.find(filter);

    if (comments_response.length === 0) {
      return httpResponses.ok(res, []);
    }

    return httpResponses.ok(res, comments_response.length === 1 ? comments_response[0] : comments_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
  }
});

/**
 * @route POST api/comments/by-id
 * @desc get comments matching by ids
 * @access public
 */
router.post('/by-id', async (req, res) => {
  try {
    let ids = req.body.ids || [];
    if (!Array.isArray(ids)) ids = [ids];
    ids = ids.filter(Boolean);

    if (ids.length === 0) {
      return httpResponses.ok(res, []);
    }

    const query = req.query;
    let mongoFilter = { _id: { $in: ids } };

    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) mongoFilter = { ...mongoFilter, ...additionalFilter };
    }

    const comments_response = await Comments.find(mongoFilter);

    return httpResponses.ok(res, comments_response.length === 1 ? comments_response[0] : comments_response);
  } catch (error) {
    return httpResponses.internalError(res, 'Error fetching comments by ids', error.message);
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
 * @route PUT api/comments/:id
 * @desc Update comment by id
 * @access auth
 */
router.put('/:id', authenticateMW, async (req, res) => {
  try {
    const updated = await Comments.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return httpResponses.notFound(res, 'Comment not found');
    }
    return httpResponses.ok(res, { message: 'Updated successfully', comment: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the comment', err.message);
  }
});

/**
 * @route DELETE api/comments/:id
 * @desc Delete comment by id
 * @access auth
 */
router.delete('/:id', authenticateMW, async (req, res) => {
  try {
    const deleted = await Comments.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return httpResponses.notFound(res, 'Comment not found');
    }
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
