const isProd = process.env.NODE_ENV === 'production';
const devMode = process.env.DEV_MODE === 'true';

// --------------------------------------------------------------------------GAMES------------------------------------------------------------------------------------
/**
 * @openapi
 * /games/test:
 *   get:
 *     summary: Test route for games
 *     description: Returns a test message. Only accessible in development mode.
 *     tags: [Games]
 *     responses:
 *       200:
 *         description: Successful test response
 */
/**
 * @openapi
 * /games:
 *   get:
 *     summary: Search games
 *     description: Search games by multiple query filters. Supports MongoDB query operands. Can search local database and external IGDB API.
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword (optional)
 *       - in: query
 *         name: platformID
 *         schema:
 *           type: integer
 *         description: Filter by platform ID (optional)
 *       - in: query
 *         name: release_date
 *         schema:
 *           type: string
 *         description: Filter by release date (optional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of results (optional)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination (optional)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: object
 *         description: Sort field and order (optional)
 *       - in: query
 *         name: external
 *         schema:
 *           type: boolean
 *         description: >
 *           If true, searches external IGDB API when local results are insufficient (default: true)
 *       - in: query
 *         name: complete
 *         schema:
 *           type: boolean
 *         description: >
 *           Whether to include full game info (default: true)
 *     responses:
 *       200:
 *         description: Array of game objects or single game
 *       204:
 *         description: No coincidences found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /games/search:
 *   get:
 *     summary: Search games by keyword
 *     description: Returns games matching a keyword search. Supports limit, offset, platform filter, release date, and sorting.
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *       - in: query
 *         name: platformID
 *         schema:
 *           type: integer
 *         description: Filter by platform ID
 *       - in: query
 *         name: release_date
 *         schema:
 *           type: string
 *         description: Filter by release date
 *       - in: query
 *         name: sort
 *         schema:
 *           type: object
 *         description: Sort field and order
 *     responses:
 *       200:
 *         description: Array of games matching search
 *       204:
 *         description: No matches found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /games/igdb:
 *   post:
 *     summary: Add games from IGDB
 *     description: Adds one or multiple games to the database using IGDB IDs or a range of IGDB IDs. Dev mode only.
 *     tags: [Games]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               IGDB_ID:
 *                 type: integer
 *                 description: Single IGDB game ID
 *               IGDB_ID_INIT:
 *                 type: integer
 *                 description: Start of IGDB ID range
 *               IGDB_ID_END:
 *                 type: integer
 *                 description: End of IGDB ID range
 *     responses:
 *       201:
 *         description: Game(s) added successfully
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: No games found
 */

/**
 * @openapi
 * /games:
 *   delete:
 *     summary: Delete a game
 *     description: Delete a game by its ID. Requires authentication and dev mode.
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Game ID to delete
 *     responses:
 *       200:
 *         description: Game deleted successfully
 *       400:
 *         description: Missing or invalid game ID
 *       404:
 *         description: Game not found
 */

/**
 * @openapi
 * /games/dev/wipe:
 *   delete:
 *     summary: Wipe all games
 *     description: Deletes all games in the database. Development mode only.
 *     tags: [Games]
 *     responses:
 *       200:
 *         description: All games deleted with deleted count
 *       500:
 *         description: Server error while wiping games
 */
//--------------------------------------------------------------------------PLATFORMS----------------------------------------------------------------
// --------------------------------------------------------------------------PLATFORMS------------------------------------------------------------------------------------
/**
 * @openapi
 * /platforms/test:
 *   get:
 *     summary: Test route for platforms
 *     description: Returns a test message. Only accessible in development mode.
 *     tags: [Platforms]
 *     responses:
 *       200:
 *         description: Successful test response
 */

/**
 * @openapi
 * /platforms:
 *   get:
 *     summary: Search platforms
 *     description: Search platforms by query filters. Supports MongoDB query operands. Can fetch by ID or other fields.
 *     tags: [Platforms]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Platform ID (optional)
 *       - in: query
 *         name: abbreviation
 *         schema:
 *           type: string
 *         description: Platform abbreviation (optional)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Platform name (optional)
 *       - in: query
 *         name: generation
 *         schema:
 *           type: integer
 *         description: Platform generation (optional)
 *     responses:
 *       200:
 *         description: Array of platform objects or single platform
 *       204:
 *         description: No coincidences found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /platforms/refresh-igdb:
 *   post:
 *     summary: Sync platforms from IGDB
 *     description: Fetches platforms from IGDB API and updates local database. Inserts new platforms, updates existing ones if changed. Dev mode only.
 *     tags: [Platforms]
 *     responses:
 *       200:
 *         description: Platforms synced successfully, returns inserted and updated counts
 *       500:
 *         description: Error syncing platforms
 */

/**
 * @openapi
 * /platforms/dev/wipe:
 *   delete:
 *     summary: Wipe all platforms
 *     description: Deletes all platform entries in the database. Development mode only.
 *     tags: [Platforms]
 *     responses:
 *       200:
 *         description: All platforms deleted with deleted count
 *       500:
 *         description: Server error while wiping platforms
 */


// --------------------------------------------------------------------------SAVEDATAS------------------------------------------------------------------------------------
/**
 * @openapi
 * /savedatas/test:
 *   get:
 *     summary: Test route for savedatas
 *     description: Returns a test message. Only accessible in development mode.
 *     tags: [Savedatas]
 *     responses:
 *       200:
 *         description: Successful test response
 */

/**
 * @openapi
 * /savedatas:
 *   get:
 *     summary: Search savedatas
 *     description: Search savedatas by query filters. Supports MongoDB query operands. Can fetch by ID or other fields.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Savedata ID (optional)
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: Title of savedata (optional)
 *       - in: query
 *         name: gameID
 *         schema:
 *           type: number
 *         description: Game ID (optional)
 *       - in: query
 *         name: userID
 *         schema:
 *           type: string
 *         description: User ID (optional)
 *     responses:
 *       200:
 *         description: Array of savedata objects or single savedata
 *       204:
 *         description: No coincidences found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /savedatas/search:
 *   get:
 *     summary: Search savedatas by text
 *     description: Full-text search across title, description, game title, platform, and user info.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Array of matching savedata
 *       204:
 *         description: No coincidences found
 */

/**
 * @openapi
 * /savedatas:
 *   post:
 *     summary: Upload a savedata
 *     description: Upload a savedata file with optional screenshots. Requires authentication.
 *     tags: [Savedatas]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               screenshots:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               gameID:
 *                 type: number
 *               platformID:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tagID:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Savedata uploaded successfully
 *       400:
 *         description: Invalid upload or missing fields
 */

/**
 * @openapi
 * /savedatas/async:
 *   post:
 *     summary: Async upload a savedata
 *     description: Starts asynchronous upload and processing of a savedata file. Returns immediately.
 *     tags: [Savedatas]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               screenshots:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               gameID:
 *                 type: number
 *               platformID:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tagID:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Asynchronous process started
 *       400:
 *         description: Invalid upload or missing fields
 */

/**
 * @openapi
 * /savedatas:
 *   put:
 *     summary: Update savedata
 *     description: Update savedata fields. Authentication required.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Savedata ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update
 *     responses:
 *       200:
 *         description: Savedata updated successfully
 *       400:
 *         description: Invalid fields or missing ID
 *       404:
 *         description: Savedata not found
 */

/**
 * @openapi
 * /savedatas/update-rating:
 *   put:
 *     summary: Like or dislike a savedata
 *     description: Updates likes or dislikes for a savedata by the authenticated user.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [like, dislike]
 *         required: true
 *     responses:
 *       200:
 *         description: Rating updated successfully
 *       400:
 *         description: Invalid query parameters
 *       404:
 *         description: Savedata not found
 */

/**
 * @openapi
 * /savedatas/reset-rating:
 *   put:
 *     summary: Reset user rating on a savedata
 *     description: Removes the like or dislike of the authenticated user for a specific savedata.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Ratings reset successfully
 *       404:
 *         description: Savedata not found
 */

/**
 * @openapi
 * /savedatas:
 *   delete:
 *     summary: Delete savedata
 *     description: Deletes a savedata by ID. Authentication required.
 *     tags: [Savedatas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Savedata deleted successfully
 *       404:
 *         description: Savedata not found
 */

/**
 * @openapi
 * /savedatas/dev/wipe:
 *   delete:
 *     summary: Wipe all savedatas
 *     description: Deletes all savedatas and resets related game upload counters. Development mode only.
 *     tags: [Savedatas]
 *     responses:
 *       200:
 *         description: All savedatas deleted successfully
 *       500:
 *         description: Server error while wiping savedatas
 */
//------------------------------------------------------------------TAGS--------------------------------------------------------

// --------------------------------------------------------------------------TAGS------------------------------------------------------------------------------------
/**
 * @openapi
 * /tags/test:
 *   get:
 *     summary: Test route for tags
 *     description: Returns a test message. Only accessible in development mode.
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: Successful test response
 */

/**
 * @openapi
 * /tags:
 *   get:
 *     summary: Search tags
 *     description: Search tags by query filters. Supports MongoDB query operands. Can fetch by ID or other fields.
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Tag ID (optional)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Tag name (optional)
 *     responses:
 *       200:
 *         description: Array of tag objects or single tag
 *       204:
 *         description: No coincidences found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /tags:
 *   post:
 *     summary: Create a new tag
 *     description: Adds a new tag to the database. Development mode only.
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag created successfully
 *       400:
 *         description: Invalid input
 */

/**
 * @openapi
 * /tags:
 *   put:
 *     summary: Update tag by ID
 *     description: Updates tag fields. Development mode only.
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Tag ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *       400:
 *         description: Invalid fields or missing ID
 *       404:
 *         description: Tag not found
 */

/**
 * @openapi
 * /tags:
 *   delete:
 *     summary: Delete tag by ID
 *     description: Deletes a tag by ID. Development mode only.
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Tag ID
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *       404:
 *         description: Tag not found
 *       400:
 *         description: Missing ID
 */

/**
 * @openapi
 * /tags/dev/wipe:
 *   delete:
 *     summary: Wipe all tags
 *     description: Deletes all tags in the database. Development mode only.
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: All tags deleted successfully
 *       500:
 *         description: Server error while wiping tags
 */

//--------------------------------------------------------------------------ASSETS----------------------------------------------------------------------
/**
 * @openapi
 * /assets/savedata/{id}/scr:
 *   get:
 *     summary: Download all screenshots for a savefile as a zip
 *     description: Returns a zip containing all screenshots for the savefile. Returns 204 if no screenshots exist.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Savefile ID
 *     responses:
 *       200:
 *         description: Zip containing all screenshots
 *       204:
 *         description: No screenshots available
 *       404:
 *         description: Savefile not found
 */

/**
 * @openapi
 * /assets/savedata/{id}/scr/main:
 *   get:
 *     summary: Get the main screenshot of a savefile
 *     description: Returns the first screenshot image found for the savefile. Supports png, jpg, jpeg, webp.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Savefile ID
 *     responses:
 *       200:
 *         description: Screenshot image
 *       204:
 *         description: No screenshots available
 */

/**
 * @openapi
 * /assets/savedata/{id}/bundle:
 *   get:
 *     summary: Download savefile bundle (main save + screenshots)
 *     description: Returns a zip containing the savefile and all screenshots. Increments download count.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Savefile ID
 *     responses:
 *       200:
 *         description: Zip containing savefile and screenshots
 *       404:
 *         description: Savefile not found
 */

/**
 * @openapi
 * /assets/savedata/{id}:
 *   get:
 *     summary: Download the main savefile
 *     description: Returns the primary zip file for a savefile. Increments download count.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Savefile ID
 *     responses:
 *       200:
 *         description: Savefile zip
 *       404:
 *         description: Savefile not found
 */

/**
 * @openapi
 * /assets/user/{id}/banner:
 *   get:
 *     summary: Get user's banner image
 *     description: Returns the user's banner, or a default if none exists.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Banner image
 *       404:
 *         description: Banner not found
 */

/**
 * @openapi
 * /assets/user/{id}/pfp:
 *   get:
 *     summary: Get user's profile picture
 *     description: Returns the user's profile picture, or a default if none exists.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Profile picture image
 *       404:
 *         description: Profile picture not found
 */

/**
 * @openapi
 * /assets/user/{id}:
 *   get:
 *     summary: Download all user images
 *     description: Returns a zip containing the user's profile picture and banner.
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Zip of user images
 */

/**
 * @openapi
 * /assets/defaults/banner:
 *   get:
 *     summary: Get default banner image
 *     tags: [Assets]
 *     responses:
 *       200:
 *         description: Default banner image
 */

/**
 * @openapi
 * /assets/defaults/game-cover:
 *   get:
 *     summary: Get default game cover image
 *     tags: [Assets]
 *     responses:
 *       200:
 *         description: Default game cover image
 */

/**
 * @openapi
 * /assets/defaults/pfp:
 *   get:
 *     summary: Get default profile picture
 *     tags: [Assets]
 *     responses:
 *       200:
 *         description: Default profile picture
 */

/**
 * @openapi
 * /assets/defaults:
 *   get:
 *     summary: Download all default assets as zip
 *     tags: [Assets]
 *     responses:
 *       200:
 *         description: Zip containing all default assets
 */




// --------------------------------------------------------------------------USERS------------------------------------------------------------------------------------
/**
 * @openapi
 * /users/test:
 *   get:
 *     summary: Test route for users
 *     description: Returns a test message, only accessible in development mode.
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Successful test response
 */

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request
 */

/**
 * @openapi
 * /users/search:
 *   get:
 *     summary: Search users
 *     description: Search users by username, alias, or bio. Supports pagination and sorting.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search keyword
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Array of user objects
 *       204:
 *         description: No matches found
 *       400:
 *         description: Invalid query
 */

/**
 * @openapi
 * /users/verify-password:
 *   post:
 *     summary: Verify user password
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password validity result
 *       400:
 *         description: Password missing
 */

/**
 * @openapi
 * /users/follow-toggle:
 *   post:
 *     summary: Follow or unfollow another user
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetId:
 *                 type: integer
 *               action:
 *                 type: string
 *                 enum: [follow, unfollow]
 *     responses:
 *       200:
 *         description: Follow/unfollow result
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Target user not found
 */

/**
 * @openapi
 * /users/add-favorite:
 *   post:
 *     summary: Add a game or save to favorites
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gameID:
 *                 type: integer
 *               saveID:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Favorite added
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Game or save not found
 */

/**
 * @openapi
 * /users/remove-favorite:
 *   post:
 *     summary: Remove a game or save from favorites
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gameID:
 *                 type: integer
 *               saveID:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Favorite removed
 *       400:
 *         description: Invalid parameters
 */

/**
 * @openapi
 * /users/updateImage:
 *   post:
 *     summary: Upload or update user profile image
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: Upload error
 */

/**
 * @openapi
 * /users:
 *   put:
 *     summary: Update user profile
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid fields or request
 */

/**
 * @openapi
 * /users:
 *   delete:
 *     summary: Delete a user by ID
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */

/**
 * @openapi
 * /users/notifications:
 *   get:
 *     summary: Get logged user's notifications
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Array of notifications
 */

/**
 * @openapi
 * /users/remove-notification:
 *   delete:
 *     summary: Remove a specific notification
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification removed
 *       404:
 *         description: Notification not found
 */

/**
 * @openapi
 * /users/wipe-notifications:
 *   delete:
 *     summary: Remove all notifications
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: All notifications removed
 */

/**
 * @openapi
 * /users/read-notification:
 *   patch:
 *     summary: Mark a notification as read
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */

/**
 * @openapi
 * /users/read-all-notifications:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Requires user to be logged in
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */

// Only include dev endpoints if in development
if (devMode) {
    /**
     * @openapi
     * /users/dev/wipe:
     *   delete:
     *     summary: Delete all users (development only)
     *     tags: [Users]
     *     responses:
     *       200:
     *         description: All users deleted
     */
}
