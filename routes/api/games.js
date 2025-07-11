const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { searchGamesFromIGDB, createGameFromIGDB } = require('../../utils/IGDBQueryUtils.js');
const { Games } = require('../../models/Games');
const { Platforms } = require('../../models/Platforms');
const httpResponses = require('../../utils/httpResponses');
const {getIgdbPlatformIds} = require('../../utils/constants');
const { callIGDB } = require('../../services/igdbServices')
const { hasLocalFields } = require('../../models/modelRegistry');


/**
 * Función para crear un objeto juego a partir de datos IGDB, opcionalmente con info completa de PCGW.
 * @param {Object} game - juego crudo IGDB
 * @param {boolean} complete - si debe agregar info de PCGamingWiki
 * @returns {Object} juego formateado
 */

/**
 * @route GET api/games/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'game route testing!'));


async function localGameSearch(req, res, query) {
  // Buscar por id si viene en la query
  const fastResult = await findByID(query, 'game');
  if (fastResult !== undefined) {
    if (!fastResult) {
      return httpResponses.noContent(res, 'No coincidences');
    }
    return httpResponses.ok(res, fastResult);
  }

  // Buscar por query completo
  const results = await findByQuery(query, 'game');
  if (results.length === 0) {
    return httpResponses.noContent(res, 'No coincidences');
  }
  return httpResponses.ok(res, results.length === 1 ? results[0] : results);
}

async function externalGameSearch(req, res, query) {
  try {
    let limit = 50;
    let offset = 0;

    if (query.limit) {
      const parsedLimit = parseInt(query.limit);
      if (!isNaN(parsedLimit) && parsedLimit > 0) limit = parsedLimit;
      delete query.limit;
    }

    if (query.offset) {
      const parsedOffset = parseInt(query.offset);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) offset = parsedOffset;
      delete query.offset;
    }

    let complete = true;
    if ('complete' in query) {
      complete = !(query.complete === 'false' || query.complete === false);
      delete query.complete;
    }

    const igdbResults = await searchGamesFromIGDB({
      query,
      limit,
      offset,
      complete
    });

    if (igdbResults.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    return httpResponses.ok(res, igdbResults.length === 1 ? igdbResults[0] : igdbResults);
  } catch (err) {
    return httpResponses.badRequest(res, err.message);
  }
}


/**
 * @route GET api/games
 * @params see models/games
 * @desc get all coincidences matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = { ...req.query };
    const isExternal = (!query.external || query.external === 'true' || query.external === true)
    delete query.external;
    // Detectamos si external está explícitamente a 'false' (string) -> buscamos solo en mongodb
    // if (!isExternal) {
    if (!isExternal || hasLocalFields(query, 'game')) {
      console.log("haciendo query local")
      return await localGameSearch(req, res, query)
    }

    return await externalGameSearch(req, res, query)

  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, error.message);
  }
});


/**
 * @route POST api/games/batch
 * @desc Añadir juegos a la base de datos usando un rango de IDs de IGDB
 * @access Dev only
 */
router.post('/batch', blockIfNotDev, async (req, res) => {
  const { IGDB_ID_INIT, IGDB_ID_END } = req.body;

  if (!IGDB_ID_INIT || typeof IGDB_ID_INIT !== 'number') {
    return httpResponses.badRequest(res, 'IGDB_ID_INIT is required and must be a number');
  }

  if (!IGDB_ID_END || typeof IGDB_ID_END !== 'number') {
    return httpResponses.badRequest(res, 'IGDB_ID_END is required and must be a number');
  }

  try {
    // 2. Filtrar los IDs que no están en la base de datos
    const everyID = [];
    for (let id = IGDB_ID_INIT; id <= IGDB_ID_END; id++) {
      everyID.push(id);
    }

    if (everyID.length === 0) {
      return httpResponses.notFound(res, 'No new games to fetch; all IDs already exist in the database.');
    }
    // 3. Obtener juegos desde IGDB (una sola llamada con limit)
    const gameQuery = `
      fields id, name, cover.image_id, platforms, slug, url, first_release_date;
      where id = (${everyID.join(',')}) & platforms = (${getIgdbPlatformIds().join(',')}) & version_parent = null & game_type = (0,1,2,3,4,8,9,11);
      limit ${everyID.length};
      sort rating_count asc;
      `;
      // sort id asc;
    const gamesFromIGDB = await callIGDB('games', gameQuery);
    if (!gamesFromIGDB?.length) {
      return httpResponses.notFound(res, 'No games found or none meet GSDB criteria.');
    }

    // 4. Preparar juegos para insertar con la función extraída
    const createdGames = await Promise.all(
      gamesFromIGDB.map(game => createGameFromIGDB(game, true, false))
    );

    // 5. Insertar en lote
    await Games.insertMany(createdGames);

    return httpResponses.created(
      res,
      `${createdGames.length} games added successfully.`,
      createdGames
    );

} catch (err) {
  console.error('[ERROR] Could not add games from IGDB:', err);

  const { handler } = httpResponses.mapStatusToHttpError(err.status || 500);
  return handler(res, err.message || 'Unexpected error while adding games');
}

});

/**
 * @route DELETE api/games/:id
 * @desc delete game by id
 * @access public (authenticated + dev mode)
 */
router.delete('/', authenticateMW, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return httpResponses.badRequest(res, 'Missing "id" in query');
  }
  try {
    const game = await findByID(req.query, 'game');
    if (!game) {
      return httpResponses.notFound(res, 'Game not found');
    }

    await game.remove();

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

/**
 * @route POST api/games/favorites
 * @desc Añade al usuario autenticado a la lista de favoritos de un juego
 * @access Authenticated
 */
router.post('/favorites', authenticateMW, async (req, res) => {
  try {

    const { id: gameId } = req.query;
    if (!gameId) {
      return httpResponses.badRequest(res, 'Missing "id" in query');
    }

    const loggedUser = req.user;

    const game = await findByID({ id: gameId }, 'game');
    if (!game) return httpResponses.notFound(res, 'Game not found');

    if (!game.userFav.includes(loggedUser._id)) {
      game.userFav.push(loggedUser._id);
      await game.save();
    }

    return httpResponses.ok(res, {
      message: `User added to favorites list`
    });
  } catch (err) {
    return httpResponses.internalError(res, 'Error adding user', err.message);
  }
});

/**
 * @route DELETE api/games/:gameId/favorites
 * @desc Elimina al usuario autenticado de los favoritos del juego
 * @access Authenticated
 */
/**
 * @route DELETE api/games/favorites
 * @desc Elimina al usuario autenticado de los favoritos del juego
 * @access Authenticated
 */
router.delete('/favorites', authenticateMW, async (req, res) => {
  try {
    const { id: gameId } = req.query;
    if (!gameId) {
      return httpResponses.badRequest(res, 'Missing "id" in query');
    }
    const loggedUser = req.user;

    const game = await findByID({ id: gameId }, 'game');
    if (!game) return httpResponses.notFound(res, 'Game not found');

    const initialCount = game.userFav.length;
    game.userFav = game.userFav.filter(userId => userId.toString() !== loggedUser._id.toString());

    if (game.userFav.length === initialCount) {
      return httpResponses.notFound(res, 'User was not in favorites');
    }
    await game.save();

    return httpResponses.ok(res, {
      message: `User removed from favorites list`,
    });
  } catch (err) {
    return httpResponses.internalError(res, 'Error removing from favorites', err.message);
  }
});




module.exports = router;
