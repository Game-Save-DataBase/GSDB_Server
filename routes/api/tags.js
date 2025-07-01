const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/queryUtils');
const { Tags, filterFields } = require('../../models/Tags');
const httpResponses = require('../../utils/httpResponses');

/**
 * @route GET api/tags/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'tag route testing!'));

/**
 * @route GET api/tags
 * @desc get tags matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    if (query._id) {
      const tag = await Tags.findById(query._id);
      if (!tag) return httpResponses.notFound(res, `Tag with id ${query._id} not found`);
      return httpResponses.ok(res, tag);
    }

    const filter = buildMongoFilter(query, filterFields);
    const tags_response = await Tags.find(filter);

    if (tags_response.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    return httpResponses.ok(res, tags_response.length === 1 ? tags_response[0] : tags_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
  }
});

/**
 * @route POST api/tags/by-id
 * @desc get tags matching by ids
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

    const tags_response = await Tags.find(mongoFilter);
    if (tags_response.length === 0) return httpResponses.noContent(res, 'No coincidences');

    return httpResponses.ok(res, tags_response.length === 1 ? tags_response[0] : tags_response);
  } catch (error) {
    return httpResponses.internalError(res, 'Error fetching tags by ids', error.message);
  }
});

/**
 * @route POST api/tags/
 * @desc Create tag
 * @access auth
 */
router.post('/', authenticateMW, async (req, res) => {
  try {
    const tag = await Tags.create(req.body);
    return httpResponses.created(res, 'Tag added successfully', tag);
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to add this tag', err.message);
  }
});

/**
 * @route PUT api/tags/:id
 * @desc Update tag by id
 * @access auth
 */
router.put('/:id', authenticateMW, async (req, res) => {
  try {
    const updated = await Tags.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return httpResponses.notFound(res, 'Tag not found');
    }
    return httpResponses.ok(res, { message: 'Updated successfully', tag: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the tag', err.message);
  }
});

/**
 * @route DELETE api/tags/:id
 * @desc Delete tag by id
 * @access auth
 */
router.delete('/:id', authenticateMW, async (req, res) => {
  try {
    const deleted = await Tags.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return httpResponses.notFound(res, 'Tag not found');
    }
    return httpResponses.ok(res, { message: 'Tag entry deleted successfully' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error deleting tag', err.message);
  }
});

/**
 * @route DELETE api/tags/dev/wipe
 * @desc wipe all tags (dev only)
 * @access dev mode only
 */
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await Tags.deleteMany({});
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping tags', err.message);
  }
});

module.exports = router;
