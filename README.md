# GSDB - Game Save Database
GSDB is a platform to preserve and categorize savedata files from any videogame. It uses IGDB and PCGamingWiki API.
This repository contains the server backend and API for GSDB.
This API is implemented in the [GSDB Web App](https://gsdb-web.onrender.com/). 
Access to GSDB Web Repo:

[![GSDB Web App Repository](https://img.shields.io/badge/GitHub-Repo-181717?style=for-the-badge&logo=github)](https://github.com/Game-Save-DataBase/GSDB_Web)

## API Documentation
The full API is documented using [Swagger](https://swagger.io/). You can explore and test endpoints in the [GSDB API Docs](https://gsdb-server.onrender.com/docs).
To see the different database fields and learn how to use query parameters for filtering and sorting, see the [GSDB Wiki](https://github.com/Game-Save-DataBase/GSDB_Server/wiki).


## How to run the source code
Before cloning the repository, you need to install [Node.js](https://nodejs.org/es).

Clone the repository:

```bash
git clone https://github.com/Game-Save-DataBase/GSDB_Server.git
```
Search for the file `/.env example`. You must fill the empty variables with the environment variables needed. Rename the file to `.env` after.
> [!WARNING]  
> To run the application correctly, the `.env` file must be filled in with the required secret and user keys. 
> To access them, check the documentation provided in the `.env` file itself for each field.
> We provide the required file in  `/.env example`, which needs to be renamed to `.env` after each , 


Then, in the project root, install the required dependencies:
```bash
npm install archiver axios bcryptjs body-parser cheerio connect-mongo cors dotenv express express-session mongoose mongoose-sequence multer passport passport-local swagger-jsdoc swagger-ui-express zxcvbn
npm install --save-dev nodemon swagger-markdown widdershins
```
Finally, to run the server:
```bash
npm run start
```
If you want to run in development mode with **nodemon** (recommended):
```bash
npm run app
```



