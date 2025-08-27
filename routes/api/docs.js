const isProd = process.env.NODE_ENV === 'production';
const devMode = process.env.DEV_MODE === 'true';
// --------------------------------------------------------------------------USERS------------------------------------------------------------------------------------
/**
 * @openapi
 * /api/users/test:
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
 * /api/users:
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
 * /api/users/search:
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
 * /api/users/verify-password:
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
 * /api/users/follow-toggle:
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
 * /api/users/add-favorite:
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
 * /api/users/remove-favorite:
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
 * /api/users/updateImage:
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
 * /api/users:
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
 * /api/users:
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
 * /api/users/notifications:
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
 * /api/users/remove-notification:
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
 * /api/users/wipe-notifications:
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
 * /api/users/read-notification:
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
 * /api/users/read-all-notifications:
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
     * /api/users/dev/wipe:
     *   delete:
     *     summary: Delete all users (development only)
     *     tags: [Users]
     *     responses:
     *       200:
     *         description: All users deleted
     */
}
