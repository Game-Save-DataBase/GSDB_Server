const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/queryUtils');
const { Games, mapFiltersToIGDB, processQuery } = require('../../models/Games');
const { Platforms } = require('../../models/Platforms');
const httpResponses = require('../../utils/httpResponses');
const { callIGDB } = require('../../services/igdbServices')
const { getSaveFileLocations } = require('../../services/pcgwServices');
const config = require('../../utils/config');
const { hasStaticFields } = require('../../models/modelRegistry');


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
    const query = { ...req.query };
    const isExternal = (!query.external || query.external === 'true' || query.external === true)
    delete query.external;

    // Detectamos si external está explícitamente a 'false' (string) -> buscamos solo en mongodb
    // if (!isExternal) {
    if(true){
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

    //IGNORAMOS POR AHORAAAAAAAAAAAAA

    // Si no es external=false => mezcla IGDB + mongodb

    // Obtener plataformas IGDB para filtro
    const fixedQuery = processQuery(query)
    console.log(fixedQuery)
    // Construimos el filtro IGDB
    const whereString = await buildIGDBFilter(fixedQuery, filterFields, mapFiltersToIGDB);
    const baseConditions = [
      'version_parent = null',
      'game_type = (11,8,4,0)'
      // 'game_status != 6'
    ];
    if (whereString) {
      baseConditions.push(whereString);
    }
    const finalWhere = baseConditions.join(' & ');

    const igdbQuery = `
      fields name, cover, platforms, slug, id, url, first_release_date;
      limit ${limit};
      offset ${offset};
      where ${finalWhere};
      sort id asc;
    `;
    console.log(igdbQuery)
    const igdbResultsRaw = await callIGDB('games', igdbQuery);

    // IDs para buscar en local
    const igdbIDs = igdbResultsRaw.map(g => g.id);
    const existingGames = await Games.find({ IGDB_ID: { $in: igdbIDs } });
    const existingMap = new Map(existingGames.map(game => [game.IGDB_ID, game]));

    const validPlatformIDsForSaveCheck = [6, 14, 3, 13]; // Windows, Mac, Linux, DOS

    // Creamos el array completo mezclado IGDB + local
    const mixedGames = await Promise.all(igdbResultsRaw.map(async (game) => {
      const existing = existingMap.get(game.id);
      if (existing) {
        return existing;
      }

      const { name, platforms = [], cover: coverId, slug, id: IGDB_ID, url: IGDB_url, first_release_date } = game;

      let coverURL = config.paths.gameCover_default;
      if (coverId) {
        const coverQuery = `fields image_id; where id = ${coverId};`;
        const [coverData] = await callIGDB('covers', coverQuery);
        if (coverData?.image_id) {
          coverURL = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${coverData.image_id}.jpg`;
        }
      }
      const baseGame = {
        title: name,
        platformsID: platforms,
        savesID: [],
        cover: coverURL,
        IGDB_ID,
        IGDB_url,
        release_date: first_release_date ? new Date(first_release_date * 1000) : undefined,
        slug,
        external: true,
      };

      // Filtrar plataformas que nos interesan para hacer llamada a PCGamingWiki
      const matchingPlatforms = platforms.filter(p => validPlatformIDsForSaveCheck.includes(p));

      if (matchingPlatforms.length > 0) {
        const saveData = await getSaveFileLocations(name);
        if (saveData?.saveLocations?.length) {
          baseGame.PCGW_ID = saveData.pcgwID;
          baseGame.PCGW_url = saveData.pcgwURL;
          baseGame.saveLocations = saveData.saveLocations
            .filter(loc => matchingPlatforms.includes(loc.platform)) // filtra por platform numérico
            .map(loc => ({
              platform: loc.platform,       // ej 6
              platformName: loc.platformName, // ej "Steam Play (Linux)" o "Windows"
              locations: loc.locations,
            }));
        }
      }


      return baseGame;
    }));

    if (mixedGames.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    // mixedGames.sort((a, b) => a.title.localeCompare(b.title));
    mixedGames.sort((a, b) => a.IGDB_ID - b.IGDB_ID);
    return httpResponses.ok(res, mixedGames.length === 1 ? mixedGames[0] : mixedGames);

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
    const platformIDs = await Platforms.find().distinct('IGDB_ID');

    // 1. Obtener los juegos ya existentes en ese rango
    const existingIDs = await Games.find({
      IGDB_ID: { $gte: IGDB_ID_INIT, $lte: IGDB_ID_END },
    }).distinct('IGDB_ID');

    // 2. Filtrar los IDs que no están en la base de datos
    const everyID = [];
    for (let id = IGDB_ID_INIT; id <= IGDB_ID_END; id++) {
      if (!existingIDs.includes(id)) {
        everyID.push(id);
      }
    }

    if (everyID.length === 0) {
      return httpResponses.notFound(res, 'No new games to fetch; all IDs already exist in the database.');
    }

    // 3. Obtener juegos desde IGDB (una sola llamada con limit)
    const gameQuery = `
      fields id, name, cover, platforms, slug, url;
      where id = (${everyID.join(',')}) & platforms = (${platformIDs.join(',')}) & version_parent = null & game_type = (11,8,4,0);
      limit ${everyID.length};
    `;
    const gamesFromIGDB = await callIGDB('games', gameQuery);

    if (!gamesFromIGDB?.length) {
      return httpResponses.notFound(res, 'No games found or none meet GSDB criteria.');
    }

    // 4. Obtener los covers únicos usados (una sola llamada con limit)
    const coverIDs = gamesFromIGDB
      .map(game => game.cover)
      .filter(Boolean);

    const coverMap = {};
    if (coverIDs.length) {
      const coverQuery = `
        fields id, image_id;
        where id = (${[...new Set(coverIDs)].join(',')});
        limit ${coverIDs.length};
      `;
      const coversFromIGDB = await callIGDB('covers', coverQuery);

      coversFromIGDB.forEach(c => {
        coverMap[c.id] = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${c.image_id}.jpg`;
      });
    }

    // 5. Preparar juegos para insertar
    const newGames = gamesFromIGDB.map(game => {
      const {
        id: IGDB_ID,
        name,
        platforms = [],
        cover: coverId,
        slug,
        url
      } = game;

      return {
        title: name,
        platformID: platforms.map(id => id.toString()),
        savesID: [],
        cover: coverMap[coverId] || config.paths.gameCover_default,
        IGDB_ID,
        IGDB_url: url,
        slug,
        external: false,
      };
    });

    // 6. Insertar en lote
    // 6. Insertar en lote usando save para que mongoose-sequence funcione
    const createdGames = await Promise.all(
      newGames.map(gameData => {
        const game = new Games(gameData);
        return game.save();
      })
    );

    return httpResponses.created(
      res,
      `${createdGames.length} games added successfully.`,
      createdGames
    );

  } catch (err) {
    console.error('[ERROR] Could not add games from IGDB:', err);
    return httpResponses.internalError(res, 'Error adding games', err.message || err);
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
