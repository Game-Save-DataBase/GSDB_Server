const express = require('express');
const router = express.Router();
const blockIfNotDev = require('../../middleware/devModeMW');
const { findByID, findByQuery } = require('../../utils/localQueryUtils');
const { hasStaticFields } = require('../../models/modelRegistry');
const { Platforms } = require('../../models/Platforms');
const httpResponses = require('../../utils/httpResponses');
const { callIGDB } = require('../../services/igdbServices');
const checkInternalToken = require('../../middleware/internalMW');


// Función para sincronizar plataformas de IGDB y actualizar Mongo
async function syncPlatformsFromIGDB() {
  try {
    console.log("synking platforms...")
    // 1) Consultar platform_logos para id -> url
    const logosQuery = `fields id, url; limit 500;`;
    const platformLogos = await callIGDB('platform_logos', logosQuery);
    const logoMap = new Map(platformLogos.map(l => [l.id, l.url]));

    // 2) Consultar platform_families para id -> name
    const familiesQuery = `fields id, name; limit 500;`;
    const platformFamilies = await callIGDB('platform_families', familiesQuery);
    const familyMap = new Map(platformFamilies.map(f => [f.id, f.name]));

    // 3) Consultar plataformas con abbreviation válida
    const platformsQuery = `
      fields id, abbreviation, generation, name, slug, platform_logo, platform_family, url;
      where abbreviation != null & abbreviation != "";
      sort name asc;
      limit 500;
    `;
    const igdbPlatforms = await callIGDB('platforms', platformsQuery);

    if (!Array.isArray(igdbPlatforms)) {
      throw new Error('Invalid response from IGDB');
    }

    // 4) Mapear id a url o name para logo y family respectivamente
    let updatedCount = 0;
    let insertedCount = 0;

    // 4) Insertar o actualizar una a una (para que mongoose-sequence funcione)
    for (const p of igdbPlatforms) {
      const existing = await Platforms.findOne({ abbreviation: p.abbreviation });

      const platformData = {
        IGDB_ID: p.id,
        abbreviation: p.abbreviation,
        generation: p.generation,
        name: p.name,
        slug: p.slug,
        logo: logoMap.get(p.platform_logo)
          ? logoMap.get(p.platform_logo).replace('t_thumb', 't_logo_med').replace('.jpg', '.png')
          : null,
        family: familyMap.get(p.platform_family) || null,
        url: p.url,
      };

      if (existing) {
        // Actualizar existente
        Object.assign(existing, platformData);
        await existing.save();
        updatedCount++;
      } else {
        // Crear nuevo (esto generará el platformID)
        const newPlatform = new Platforms(platformData);
        await newPlatform.save();
        insertedCount++;
      }
    }

    return { updatedCount, insertedCount };

  } catch (error) {
    console.error("Error syncing platforms:", error);
    throw error;
  }
}

/**
 * @route GET api/platforms/test
 * @desc testing, ping
 * @access public
 */
router.get('/test', blockIfNotDev, (req, res) => httpResponses.ok(res, 'platform route testing!'));

/**
 * @route GET api/platforms
 * @desc get platforms matching query filters (supports mongodb operands)
 * @access public
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    // Intentar obtener por id rápidamente
    const fastResult = await findByID(query, 'platform');
    if (fastResult !== undefined) {
      if (!fastResult) {
        return httpResponses.noContent(res, 'No coincidences');
      }
      return httpResponses.ok(res, fastResult);
    }

    // Buscar por query si no hay id o no se encontró por id
    const results = await findByQuery(query, 'platform');
    if (results.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }
    return httpResponses.ok(res, results.length === 1 ? results[0] : results);

  } catch (error) {
    if (error.name === 'InvalidQueryFields') {
      return httpResponses.badRequest(res, error.message);
    }
    return httpResponses.internalError(res, 'Server error', error.message);
  }
});

/**
 * @route POST api/platforms/refresh-igdb
 * @desc Sync platforms from IGDB into local database
 * @access dev only
 */
router.post('/refresh-igdb',checkInternalToken, async (req, res) => {
  try {
    const result = await syncPlatformsFromIGDB();
    return httpResponses.ok(res, { message: 'Platforms synced successfully', result });
  } catch (err) {
    return httpResponses.internalError(res, 'Error syncing platforms from IGDB', err.message || err);
  }
});



/**
 * @route DELETE api/platforms/dev/wipe
 * @desc wipe all platforms (dev only)
 * @access dev mode only
 */
router.delete('/dev/wipe', blockIfNotDev, async (req, res) => {
  try {
    const result = await Platforms.deleteMany({});
    return httpResponses.ok(res, { deletedCount: result.deletedCount });
  } catch (err) {
    return httpResponses.internalError(res, 'Error wiping platforms', err.message);
  }
});

module.exports = router;
