const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/queryUtils');
const { Games, filterFields } = require('../../models/games');
const httpResponses = require('../../utils/httpResponses');
const {callIGDB} = require('../../services/igdbServices')
const config = require('../../utils/config');


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
 * @desc Añadir un juego a la base de datos usando un ID de IGDB
 * @access Authenticated
 */
router.post('/', authenticateMW, async (req, res) => {
  const { IGDB_ID } = req.body;

  if (!IGDB_ID || typeof IGDB_ID !== 'number') {
    return httpResponses.badRequest(res, 'IGDB_ID is required and must be a number');
  }

  try {
    const existing = await Games.findOne({ IGDB_ID });
    if (existing) {
      return httpResponses.conflict(res, 'Game already exists in GSDB');
    }

    // game data
    const gameQuery = `fields name, cover, platforms, slug; where id = ${IGDB_ID};`;
    const [gameFromIGDB] = await callIGDB('games', gameQuery);

    if (!gameFromIGDB) {
      return httpResponses.notFound(res, `Game with ID ${IGDB_ID} does not exist in IGDB`);
    }

    const { name, platforms = [], cover: coverId, slug } = gameFromIGDB;

    //2. sacamos la url de la imagen
    let coverURL = config.paths.gameCover_default;
    if (coverId) {
      const coverQuery = `fields image_id; where id = ${coverId};`;
      const [coverData] = await callIGDB('covers', coverQuery);

      if (coverData?.image_id) {
        coverURL = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${coverData.image_id}.jpg`;
      }
    }

    // 3: creating game
    const newGame = {
      title: name,
      platformsID: platforms.map(id => id.toString()),
      savesID: [],
      cover: coverURL,
      IGDB_ID,
      slug,
    };

    const createdGame = await Games.create(newGame);
    return httpResponses.created(res, `Game ${newGame.title} with IGDB ID ${newGame.IGDB_ID} added successfully.`, createdGame);

  } catch (err) {
    console.error('[ERROR] Could not add game from IGDB:', err);
    return httpResponses.serverError(res, 'Error adding game', err.message || err);
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
