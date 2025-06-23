const express = require('express');
const router = express.Router();
const authenticateMW = require('../../middleware/authMW');
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter, buildIGDBFilter } = require('../../utils/queryUtils');
const { Games, filterFields, mapFiltersToIGDB } = require('../../models/games');
const { Platforms } = require('../../models/platforms');
const httpResponses = require('../../utils/httpResponses');
const { callIGDB } = require('../../services/igdbServices')
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
    const query = { ...req.query };
    const searchIGDB = query.searchIGDB === 'true';
    delete query.searchIGDB;

    if (query._id) {
      const game = await Games.findById(query._id);
      if (!game) return httpResponses.notFound(res, `Game with id ${query._id} not found`);
      return httpResponses.ok(res, game);
    }

    const limit = Math.min(Math.max(parseInt(query.limit) || 30, 1), 100);
    const offset = Math.max(parseInt(query.offset) || 0, 0);
    delete query.limit;
    delete query.offset;

    if (searchIGDB) {
      // Construimos el filtro where para IGDB usando la query y el mapeo

      const platformIDs = await Platforms.find().distinct('IGDB_ID');


      const whereString = buildIGDBFilter(query, filterFields, mapFiltersToIGDB);
      const baseConditions = [
        'version_parent = null',
        `platforms = (${platformIDs.join(',')})`,
        'game_type = (11,8,4,0)'
      ];
      if (whereString) {
        baseConditions.push(whereString);
      }
      const finalWhere = `${baseConditions.join(' & ')}`;

      console.log(whereString)
      // Armamos la query IGDB completa
      let igdbQuery = `
          fields name, cover, platforms, slug, id, url;
          limit ${limit};
          offset ${offset};
          where ${finalWhere};
        `;
      if (query.title && typeof query.title === 'object' && query.title.like) {
        igdbQuery = `search "${query.title.like}";\n` + igdbQuery;
      }

      console.log(igdbQuery);

      const igdbResultsRaw = await callIGDB('games', igdbQuery);

      // Enriquecemos con la URL del cover
      const enrichedGames = await Promise.all(igdbResultsRaw.map(async (game) => {
        const { name, platforms = [], cover: coverId, slug, id: IGDB_ID, url: IGDB_url } = game;

        let coverURL = config.paths.gameCover_default;
        if (coverId) {
          const coverQuery = `fields image_id; where id = ${coverId};`;
          const [coverData] = await callIGDB('covers', coverQuery);
          if (coverData?.image_id) {
            coverURL = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${coverData.image_id}.jpg`;
          }
        }

        return {
          title: name,
          platformsID: platforms,
          savesID: [],
          cover: coverURL,
          IGDB_ID,
          IGDB_url,
          slug,
          external: true,
        };
      }));

      const igdbIDs = enrichedGames.map(g => g.IGDB_ID);
      const existingGames = await Games.find({ IGDB_ID: { $in: igdbIDs } });
      const existingMap = new Map(existingGames.map(game => [game.IGDB_ID, game]));
      const finalResults = enrichedGames
        .map(game => existingMap.get(game.IGDB_ID) || game)
        .sort((a, b) => a.title.localeCompare(b.title));
      console.log(finalResults)
      if (finalResults.length === 0) {
        return httpResponses.noContent(res, 'No coincidences');
      }

      return httpResponses.ok(res, finalResults.length === 1 ? finalResults[0] : finalResults);
    }

    // Filtro local para Mongo
    const filter = buildMongoFilter(query, filterFields);
    let gamesQuery = Games.find(filter).sort({ title: 1 }).skip(offset);
    if (limit > 0) gamesQuery = gamesQuery.limit(limit);

    const games_response = await gamesQuery;

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
    if (games_response === 0) return httpResponses.noContent(res, 'No coincidences');

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

    const platformIDs = await Platforms.find().distinct('IGDB_ID');

    const gameQuery = `fields name, cover, platforms, slug, url; where id = ${IGDB_ID} & platforms = (${platformIDs.join(',')});`;
    // console.log(gameQuery);
    const [gameFromIGDB] = await callIGDB('games', gameQuery);

    if (!gameFromIGDB) {
      return httpResponses.notFound(res, `Game with ID ${IGDB_ID} does not exist in IGDB or does not follow GSDB restrictions.`);
    }

    const { name, platforms = [], cover: coverId, slug, url } = gameFromIGDB;

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
      IGDB_url: url,
      slug,
      external: false,
    };

    const createdGame = await Games.create(newGame);
    return httpResponses.created(res, `Game ${newGame.title} with IGDB ID ${newGame.IGDB_ID} added successfully.`, createdGame);

  } catch (err) {
    console.error('[ERROR] Could not add game from IGDB:', err);
    return httpResponses.internalError(res, 'Error adding game', err.message || err);
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
      where id = (${everyID.join(',')}) & platforms = (${platformIDs.join(',')});
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
        platformsID: platforms.map(id => id.toString()),
        savesID: [],
        cover: coverMap[coverId] || config.paths.gameCover_default,
        IGDB_ID,
        IGDB_url: url,
        slug,
        external: false,
      };
    });

    // 6. Insertar en lote
    const createdGames = await Games.insertMany(newGames, { ordered: false });

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

/**
 * @route POST api/games/:gameId/favorites
 * @desc Añade al usuario autenticado a la lista de favoritos de un juego
 * @access Authenticated
 */
router.post('/:id/favorites', authenticateMW, async (req, res) => {
  try {
    const gameId = req.params.id;
    const loggedUser = req.user;

    if (!loggedUser) return httpResponses.unauthorized(res, 'Not logged in');

    const game = await Games.findById(gameId);
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
router.delete('/:id/favorites', authenticateMW, async (req, res) => {
  try {
    const gameId = req.params.id;
    const loggedUser = req.user;

    if (!loggedUser) return httpResponses.unauthorized(res, 'Not logged in');

    const game = await Games.findById(gameId);
    if (!game) return httpResponses.notFound(res, 'Game not found');

    const initialCount = game.userFav.length;
    game.userFav = game.userFav.filter(id => id.toString() !== loggedUser._id);

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
