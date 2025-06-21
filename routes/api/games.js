const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/mongoutils');
const { Games, filterFields } = require('../../models/games');
const httpResponses = require('../../utils/httpResponses');

/**
 * @route GET api/games/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'game route testing!'));

/**
 * @route GET api/games
 * @params see models/games
 * @desc get all coincidences matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    if (query._id) {
      const game = await Games.findById(query._id);
      if (!game) return httpResponses.notFound(res, `Game with id ${query._id} not found`);
      return httpResponses.ok(res, game);
    }
        // Parsear y validar limit/offset
    const limit = Math.min(parseInt(query.limit) || 0, 100);
    const offset = parseInt(query.offset) || 0;

        // Eliminar del query para que no interfiera en buildMongoFilter
    delete query.limit;
    delete query.offset;

    const filter = buildMongoFilter(query, filterFields);

    let gamesQuery = Games.find(filter).skip(offset);
    if (limit > 0) gamesQuery = gamesQuery.limit(limit);

    const games_response = await gamesQuery;

    // Si no hay resultados, devuelvo array vacío, no 404
    if (games_response.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    return httpResponses.ok(res, games_response.length === 1 ? games_response[0] : games_response);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
  }
});

/**
 * @route POST api/games/by-id
 * @body ids = [String], platformsID = [String]
 * @desc get all games matching by ids or platformsID
 * @access public
 */
router.post('/by-id', async (req, res) => {
  try {
    const query = req.query;
    let ids = req.body.ids || [];
    let platformsID = req.body.platformsID || [];

    if (!Array.isArray(ids)) ids = [ids];
    if (!Array.isArray(platformsID)) platformsID = [platformsID];

    ids = ids.filter(Boolean);
    platformsID = platformsID.filter(Boolean);

    // Si ambos arrays están vacíos, devuelvo array vacío
    if (ids.length === 0 && platformsID.length === 0) {
      return httpResponses.ok(res, []);
    }

    let mongoFilter = {
      $or: [
        { _id: { $in: ids } },
        { platformsID: { $in: platformsID } }
      ]
    };

    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) {
        mongoFilter = { ...mongoFilter, ...additionalFilter };
      }
    }

    const games_response = await Games.find(mongoFilter);
    if(games_response ===0) return httpResponses.noContent(res, 'No coincidences');

    return httpResponses.ok(res, games_response.length === 1 ? games_response[0] : games_response);
  } catch (error) {
    return httpResponses.internalError(res, 'Error fetching games by ids or platform ids', error.message);
  }
});

/**
 * @route POST api/games
 * @desc add/save game
 * @access public (authenticated)
 */
router.post('/', authenticateMW, async (req, res) => {
  try {
    const game = await Games.create(req.body);
    return httpResponses.created(res, 'Game added successfully', game);
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to add this game', err.message);
  }
});

/**
 * @route PUT api/games/:id
 * @desc update game by id
 * @access public (authenticated + dev mode)
 */
router.put('/:id', blockIfNotDev, authenticateMW, async (req, res) => {
  try {
    const updated = await Games.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return httpResponses.notFound(res, 'Game not found');
    }
    return httpResponses.ok(res, { message: 'Updated successfully', game: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the game', err.message);
  }
});

/**
 * @route DELETE api/games/:id
 * @desc delete game by id
 * @access public (authenticated + dev mode)
 */
router.delete('/:id', blockIfNotDev, authenticateMW, async (req, res) => {
  try {
    const deleted = await Games.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return httpResponses.notFound(res, 'Game not found');
    }
    return httpResponses.ok(res, { message: 'Game entry deleted successfully' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error deleting game', err.message);
  }
});

/**
 * @route DELETE api/games/dev/wipe
 * @desc wipe all games (dev only)
 * @access dev mode only
 */
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await Games.deleteMany({});
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping games', err.message);
  }
});

module.exports = router;
