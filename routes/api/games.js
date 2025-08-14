const express = require('express');
const router = express.Router();
const { authenticateMW } = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const checkInternalToken = require('../../middleware/internalMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { searchGamesFromIGDB, createGameFromIGDB } = require('../../utils/IGDBQueryUtils.js');
const { Games } = require('../../models/Games');
const httpResponses = require('../../utils/httpResponses');
const { callIGDB } = require('../../services/igdbServices')
const { hasLocalFields } = require('../../models/modelRegistry');
const { Platforms } = require('../../models/Platforms');


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
// Función principal de búsqueda híbrida
async function externalGameSearch(req, res, query, modelName = 'Game') {
  let limit = 50;
  let offset = 0;
  let sort = {};

  // Extraer limit
  if (query.limit) {
    const parsedLimit = parseInt(query.limit);
    if (!isNaN(parsedLimit) && parsedLimit > 0) limit = parsedLimit;
    delete query.limit;
  }

  // Extraer offset
  if (query.offset) {
    const parsedOffset = parseInt(query.offset);
    if (!isNaN(parsedOffset) && parsedOffset >= 0) offset = parsedOffset;
    delete query.offset;
  }

  //TO DO: Esto no entrara asi en la query. Entraria como sort:{campo:{orden}}
  // Extraer sort
  if (query.sort && typeof query.sort === 'object') {
    sort = { value: query.sort.value, order: query.sort.order };
  }

  // Extraer complete
  let complete = true;
  if ('complete' in query) {
    complete = !(query.complete === 'false' || query.complete === false);
    delete query.complete;
  }

  const isLocalSort = sort.value ? hasLocalFields({ [sort.value]: true }, modelName) : false;

  let results = [];

  if (isLocalSort) {
    results = await localGameSearch(req, res, query);

    // 3️⃣ Si hay menos resultados que los requeridos por limit/offset, buscar en IGDB
    if (results.length < limit + offset) {
      const ignoredIDs = results.map(r => r.IGDB_ID);
      const remainingLimit = limit + offset - results.length;

      //TO DO: No me convence esto de los parametros del search
      //TO DO: Transformar sort a igdb
      const igdbResults = await searchGamesFromIGDB({
        query,
        limit: remainingLimit,
        offset: 0, // empezamos desde 0 porque ya filtramos los que tenemos
        sort,
        complete,
        ignoredIDs
      });

      results = results.concat(igdbResults);
    }
  } else {
    //TO DO: Transformar sort a igdb
    results = await searchGamesFromIGDB({
      query,
      limit,
      offset,
      sort,
      complete
    });
  }

  return results;
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
    if (!isExternal || hasLocalFields(query, 'game')) {
      delete query.complete;
      return await localGameSearch(req, res, query)
    }
    const results = await externalGameSearch(query);

    if (results.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    return httpResponses.ok(res, results.length === 1 ? results[0] : results);
  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, error.message);
  }
});

router.get('/search', async (req, res) => {
  try {
    const searchValue = req.query.q || "";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    delete req.query.fast;
    const query = {
      complete: false,
      title: { like: searchValue }
    };

    if (limit) query.limit = limit;
    if (offset) query.offset = offset;
    if(req.query.platformID) query.platformID = req.query.platformID;
    if(req.query.release_date) query.release_date = req.query.release_date;

    const data = await externalGameSearch(query);

    if (!Array.isArray(data) || data.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    const normalizedQuery = searchValue.trim().toLowerCase();

    const sorted = data.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aIndex = aTitle.indexOf(normalizedQuery);
      const bIndex = bTitle.indexOf(normalizedQuery);

      if (aTitle.startsWith(normalizedQuery) && !bTitle.startsWith(normalizedQuery)) return -1;
      if (!aTitle.startsWith(normalizedQuery) && bTitle.startsWith(normalizedQuery)) return 1;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return aTitle.length - bTitle.length;
    });

    return httpResponses.ok(res, sorted);

  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, error.message);
  }
});

/**
 * @route POST api/games/igdb
 * @desc Añadir juegos a la base de datos usando un rango de IDs de IGDB
 * @access Dev only
 */
router.post('/igdb', checkInternalToken, async (req, res) => {
  const { IGDB_ID, IGDB_ID_INIT, IGDB_ID_END } = req.body;
  let igdbIds = [];

  // Validación
  if (typeof IGDB_ID === 'number') {
    igdbIds = [IGDB_ID];
  } else if (
    typeof IGDB_ID_INIT === 'number' &&
    typeof IGDB_ID_END === 'number'
  ) {
    if (IGDB_ID_END < IGDB_ID_INIT) {
      return httpResponses.badRequest(res, 'IGDB_ID_END must be greater than or equal to IGDB_ID_INIT');
    }

    for (let id = IGDB_ID_INIT; id <= IGDB_ID_END; id++) {
      igdbIds.push(id);
    }
  } else {
    return httpResponses.badRequest(
      res,
      'Must provide either IGDB_ID (number) or both IGDB_ID_INIT and IGDB_ID_END (numbers)'
    );
  }

  try {
    if (igdbIds.length === 0) {
      return httpResponses.notFound(res, 'No new games to fetch; all IDs already exist in the database.');
    }

    const platforms = await Platforms.find({}, { platformID: 1, IGDB_ID: 1, _id: 0 });
    const allPlatformsIDs = platforms.map(p => p.platformID);

    const gameQuery = `
      fields id, name, cover.image_id, screenshots.image_id, platforms, slug, url, first_release_date;
      where id = (${igdbIds.join(',')}) & platforms = (${allPlatformsIDs.join(',')}) & version_parent = null & game_type = (0,1,2,3,4,8,9,11);
      limit ${igdbIds.length};
      sort rating_count asc;
    `;
    const gamesFromIGDB = await callIGDB('games', gameQuery);
    if (!gamesFromIGDB?.length) {
      return httpResponses.notFound(res, 'No games found or none meet GSDB criteria.');
    }
    const rawCreatedGames = await Promise.all(
      gamesFromIGDB.map(game => createGameFromIGDB(game, true, false, false))
    );
    const createdGames = rawCreatedGames.filter(game => game !== undefined);

    // Inserción: uno o muchos
    if (createdGames.length === 1) {
      await new Games(createdGames[0]).save();
    } else {
      await Games.insertMany(createdGames);
    }
    // Volver a buscar desde la base de datos para obtener los documentos persistidos completos
    const savedGames = await Games.find({
      gameID: { $in: createdGames.map(game => game.gameID) }
    });

    return res.status(201).json({
      message: `${savedGames.length} game${savedGames.length > 1 ? 's' : ''} added successfully.`,
      count: savedGames.length,
      data: savedGames
    });

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
    await game.deleteOne();

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
