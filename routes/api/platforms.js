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
    console.log(' -Sincronizando datos de plataformas');

    const platformsQuery = `
      fields id, abbreviation, generation, name, slug, versions.platform_logo.url, platform_family.name, url;
      where abbreviation != null & abbreviation != "";
      sort name asc;
      limit 500;
    `;
    const igdbPlatforms = await callIGDB('platforms', platformsQuery);

    if (!Array.isArray(igdbPlatforms)) {
      throw new Error('Invalid response from IGDB');
    }

    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    console.log(' - Comprobando plataformas...');
    for (const p of igdbPlatforms) {
      const existing = await Platforms.findOne({ abbreviation: p.abbreviation });

      // Obtener la URL del logo desde versions
      let logoUrl = null;
      if (Array.isArray(p.versions) && p.versions.length > 0) {
        // Ordenar por id ascendente para tener los primeros logos de la plataforma, no revisiones
        const sortedVersions = p.versions.sort((a, b) => a.id - b.id);
        if (sortedVersions[0].platform_logo?.url) {
          logoUrl = sortedVersions[0].platform_logo.url
            .replace('t_thumb', 't_logo_med')
            .replace('.jpg', '.png');
        }
      }

      const platformData = {
        IGDB_ID: p.id,
        abbreviation: p.abbreviation,
        generation: p.generation,
        name: p.name,
        slug: p.slug,
        logo: logoUrl,
        family: p.platform_family?.name || null,
        url: p.url,
      };

      if (existing) {
        const hasChanges = Object.keys(platformData).some(
          key => String(existing[key] || '') !== String(platformData[key] || '')
        );

        if (hasChanges) {
          Object.assign(existing, platformData);
          await existing.save();
          updatedCount++;
          console.log(`Plataforma actualizada: ${p.abbreviation}`);
        } else {
          skippedCount++;
        }
      } else {
        const newPlatform = new Platforms(platformData);
        await newPlatform.save();
        insertedCount++;
      }
    }
    console.log(`-----Finalizado sincronizacion de plataformas, actualizadas: ${updatedCount}, creadas: ${insertedCount}, sin cambios: ${skippedCount}`);

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
router.post('/refresh-igdb', checkInternalToken, async (req, res) => {
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
