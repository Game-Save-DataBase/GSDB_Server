const express = require('express');
const router = express.Router();
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { Tags } = require('../../models/Tags');
const httpResponses = require('../../utils/httpResponses');
const { hasStaticFields } = require('../../models/modelRegistry');


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

    // Intentar búsqueda rápida por id
    const fastResult = await findByID(query, 'tag');
    if (fastResult !== undefined) {
      if (!fastResult) return httpResponses.noContent(res, 'Tag not found');
      return httpResponses.ok(res, fastResult);
    }

    // Si no es búsqueda rápida, hacer búsqueda por query completo
    const results = await findByQuery(query, 'tag');
    if (results.length === 0) return httpResponses.noContent(res, 'No coincidences');
    return httpResponses.ok(res, results.length === 1 ? results[0] : results);

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
  if (hasStaticFields(req.body)) {
    return httpResponses.badRequest(res, 'Body contains invalid or non existent fields to update');
  }

  try {
    // Pasamos la query completa para que findByID la analice
    const updated = await findByID(req.query, 'tag');
    if (!updated) return httpResponses.notFound(res, 'Tag not found');

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
router.delete('/', blockIfNotDev, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return httpResponses.badRequest(res, 'Missing "id" in query');
  }
  try {
    // Pasamos la query completa para que findByID la analice
    const tag = await findByID(req.query, 'tag');
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
