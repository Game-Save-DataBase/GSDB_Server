const express = require('express');
const router = express.Router();
const blockIfNotDev = require('../../middleware/devModeMW');
const { buildMongoFilter } = require('../../utils/queryUtils');
const { Platforms, filterFields } = require('../../models/Platforms');
const httpResponses = require('../../utils/httpResponses');
const { callIGDB } = require('../../services/igdbServices');


// Función para sincronizar plataformas de IGDB y actualizar Mongo
async function syncPlatformsFromIGDB() {
  try {
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
    const bulkOps = igdbPlatforms.map(p => ({
      updateOne: {
        filter: { abbreviation: p.abbreviation },
        update: {
          IGDB_ID: p.id,
          abbreviation: p.abbreviation,
          generation: p.generation,
          name: p.name,
          slug: p.slug,
          logo: logoMap.get(p.platform_logo)
            ? logoMap.get(p.platform_logo).replace('t_thumb', 't_logo_med')
            : null,
          family: familyMap.get(p.platform_family) || null,
          url: p.url,
        },
        upsert: true,
      }
    }));


    if (bulkOps.length > 0) {
      const bulkResult = await Platforms.bulkWrite(bulkOps);
      return { updatedCount: bulkResult.modifiedCount, upsertedCount: bulkResult.upsertedCount };
    } else {
      return { updatedCount: 0, upsertedCount: 0 };
    }
  } catch (error) {
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

    if (query._id) {
      const platform = await Platforms.findById(query._id);
      if (!platform) return httpResponses.notFound(res, `platform with id ${query._id} not found`);
      return httpResponses.ok(res, platform);
    }

    const filter = buildMongoFilter(query, filterFields);
    const platforms_response = await Platforms.find(filter);

    if (platforms_response.length === 0) {
      return httpResponses.noContent(res, 'No coincidences');
    }

    return httpResponses.ok(res, platforms_response.length === 1 ? platforms_response[0] : platforms_response);
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
router.post('/refresh-igdb', async (req, res) => {
  try {
    const result = await syncPlatformsFromIGDB();
    return httpResponses.ok(res, { message: 'Platforms synced successfully', result });
  } catch (err) {
    return httpResponses.internalError(res, 'Error syncing platforms from IGDB', err.message || err);
  }
});
/**
 * @route POST api/platforms/by-id
 * @desc get platforms matching by ids
 * @access public
 */
router.post('/by-id', async (req, res) => {
  try {
    let ids = req.body.ids || [];
    if (!Array.isArray(ids)) ids = [ids];
    ids = ids.filter(Boolean);

    if (ids.length === 0) {
      return httpResponses.ok(res, []);
    }

    const query = req.query;
    let mongoFilter = { IGDB_ID: { $in: ids } };

    if (Object.keys(query).length > 0) {
      const additionalFilter = buildMongoFilter(query, filterFields);
      if (additionalFilter) mongoFilter = { ...mongoFilter, ...additionalFilter };
    }

    const platforms_response = await Platforms.find(mongoFilter);
    if (platforms_response.length === 0) return httpResponses.noContent(res, 'No coincidences');

    return httpResponses.ok(res, platforms_response.length === 1 ? platforms_response[0] : platforms_response);
  } catch (error) {
    return httpResponses.internalError(res, 'Error fetching platforms by ids', error.message);
  }
});

/**
 * @route POST api/platforms/
 * @desc Create platform
 * @access auth
 */
router.post('/', blockIfNotDev, async (req, res) => {
  try {
    const platform = await Platforms.create(req.body);
    return httpResponses.created(res, 'platform added successfully', platform);
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to add this platform', err.message);
  }
});

/**
 * @route PUT api/platforms/:id
 * @desc Update platform by id
 * @access auth
 */
router.put('/:id', blockIfNotDev, async (req, res) => {
  try {
    const updated = await Platforms.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return httpResponses.notFound(res, 'platform not found');
    }
    return httpResponses.ok(res, { message: 'Updated successfully', platform: updated });
  } catch (err) {
    return httpResponses.badRequest(res, 'Unable to update the platform', err.message);
  }
});

/**
 * @route DELETE api/platforms/:id
 * @desc Delete platform by id
 * @access auth
 */
router.delete('/:id', blockIfNotDev, async (req, res) => {
  try {
    const deleted = await Platforms.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return httpResponses.notFound(res, 'platform not found');
    }
    return httpResponses.ok(res, { message: 'platform entry deleted successfully' });
  } catch (err) {
    return httpResponses.internalError(res, 'Error deleting platform', err.message);
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
