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
const { hasLocalFields, getModelDefinition } = require('../../models/modelRegistry');
const { Platforms } = require('../../models/Platforms');
const { model } = require('mongoose');


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

async function searchLocalGame(query) {
  // Buscar por id si viene en la query
  const fastResult = await findByID(query, 'game');
  if (fastResult !== undefined) {
    return fastResult ? fastResult : null;
  }

  // Buscar por query completo
  const results = await findByQuery(query, 'game');
  if (results.length === 0) {
    return null;
  }

  return results.length === 1 ? results[0] : results;
}

async function localGameSearch(req, res, query) {
  const data = await searchLocalGame(query);

  if (!data) {
    return httpResponses.noContent(res, 'No coincidences');
  }
  return httpResponses.ok(res, data);
}

// Función principal de búsqueda híbrida
async function externalGameSearch(req, res, query, modelName = 'game') {
  let limit = 50;
  let offset = 0;
  let sortField, sortOrder;
  const modelDef = getModelDefinition(modelName)
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

  if (query.sort && typeof query.sort === 'object') {
    sortOrder = Object.keys(query.sort)[0];
    sortField = query.sort[sortOrder];
    // Validar que el campo esté permitido
    if (!modelDef.filterFields[sortField]) {
      throw new Error(`cannot sort ${modelName} by ${sortField}: field does not exist`);
    }
  }

  // Extraer complete
  let complete = true;
  if ('complete' in query) {
    complete = !(query.complete === 'false' || query.complete === false);
    delete query.complete;
  }

  const isLocalSort = sortField ? hasLocalFields({ [sortField]: true }, modelName) : false;
  let results;

  console.log(isLocalSort)
  if (isLocalSort) {
    results = await searchLocalGame(query);
    console.log(query)
    if (!Array.isArray(results)) results = results ? [results] : [];

    // Si hay menos resultados que los requeridos por limit/offset, buscar en IGDB
    let ignoredIDs;
    let remainingLimit = limit + offset;
    if (results.length < limit + offset) {
      ignoredIDs = results.map(r => r.gameID);
      if (!Array.isArray(ignoredIDs)) ignoredIDs = [ignoredIDs];
      remainingLimit = limit + offset - results.length;
    }

    const igdbResults = await searchGamesFromIGDB({
      query,
      limit: remainingLimit,
      offset: 0, // empezamos desde 0 porque ya filtramos los que tenemos
      sort: null,
      complete,
      ignoredIDs
    });
    results = results.concat(igdbResults || []);
  } else {
    delete query.sort;
    results = await searchGamesFromIGDB({
      query,
      limit,
      offset,
      sort: modelDef.igdbFilterFields[sortField] ? `${modelDef.igdbFilterFields[sortField]} ${sortOrder}` : null,
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
    const results = await externalGameSearch(req, res, query);

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
    const searchValue = (req.query.q || "").trim();
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    delete req.query.fast;
    let sortField, sortOrder;
    let isSorted = false;

    const query = { complete: false };
    if (searchValue !== "") {
      query.title = { like: searchValue };
    }
    if (limit) query.limit = limit;
    if (offset) query.offset = offset;
    if (req.query.platformID) query.platformID = req.query.platformID;
    if (req.query.release_date) query.release_date = req.query.release_date;
    if (req.query.sort && typeof req.query.sort === 'object') {
      const modelDef = getModelDefinition('game')
      sortOrder = Object.keys(req.query.sort)[0];
      sortField = req.query.sort[sortOrder];
      query.sort = req.query.sort;
      isSorted = true
      if (!modelDef.filterFields[sortField]) {
        delete query.sort; sortOrder = null; sortField = null;
        isSorted = false;
      }
    }
    const data = await externalGameSearch(req, res, query);
    if (!Array.isArray(data) || data.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    const normalizedQuery = searchValue.trim().toLowerCase();
    let sorted;
    if (!isSorted) {
      //sort predeterminado que prioriza los que se llamen igual
      sorted = data.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aIndex = aTitle.indexOf(normalizedQuery);
        const bIndex = bTitle.indexOf(normalizedQuery);

        if (aTitle.startsWith(normalizedQuery) && !bTitle.startsWith(normalizedQuery)) return -1;
        if (!aTitle.startsWith(normalizedQuery) && bTitle.startsWith(normalizedQuery)) return 1;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return aTitle.length - bTitle.length;
      });
    } else {
      sorted = data;
    }
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
    const allPlatformsIDs = platforms.map(p => p.IGDB_ID);

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
