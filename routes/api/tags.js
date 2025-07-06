const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/localQueryUtils');
const { Tags, filterFields, findByFlexibleId } = require('../../models/Tags');
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

    if (query.id) {
      const t = await Tags.findByFlexibleId(query.id);
      if (!t) {
        return httpResponses.notFound(res, `Tag with id ${query.id} not found`);
      }
      return httpResponses.ok(res, t);
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
 * @route POST api/tags/
 * @desc Create tag
 * @access auth
 */
router.post('/', blockIfNotDev, async (req, res) => {
  try {
    const tag = await Tags.create(req.body);
    return httpResponses.created(res, 'Tag added successfully', tag);
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to add this tag', err.message);
  }
});

/**
 * @route PUT api/tags/
 * @desc Update tag by id
 * @access auth
 */
router.put('/', blockIfNotDev, async (req, res) => {
  const { id } = req.query;

  if (!id) return httpResponses.badRequest(res, 'Missing "id" in query');
  delete query.id;
  if (hasStaticFields(req.body)) {
    return httpResponses.badRequest(res, 'Body contains invalid or non existent fields to update');
  }

  try {
    const updated = await Tags.findByFlexibleId(id);
    if (!updated) return httpResponses.notFound(res, 'Tag not found');
    Object.assign(updated, req.body);
    await updated.save();

    return httpResponses.ok(res, { message: 'Updated successfully', tag: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the tag', err.message);
  }
});

/**
 * @route DELETE api/tags/
 * @desc Delete tag by id
 * @access auth
 */
router.delete('/', blockIfNotDev, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return httpResponses.badRequest(res, 'Missing "id" in query');
  }
  try {
    const tag = await Tags.findByFlexibleId(id);

    if (!tag) {
      return httpResponses.notFound(res, 'Tag not found');
    }

    await tag.remove();

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
