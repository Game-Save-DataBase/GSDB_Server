const config = require('./utils/config');
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const connectDB = require('./config/db');
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require('path');
const passport = require('./config/passport');
const routesGames = require("./routes/api/games");
const routesPlatforms = require("./routes/api/platforms");
const routesSaveDatas = require("./routes/api/savedatas");
const routesComments = require("./routes/api/comments");
const routesUsers = require("./routes/api/users");
const routesAuth = require("./routes/api/auth");
const routesTags = require("./routes/api/tags");
const routesAssets = require("./routes/api/assets");

const { refreshIGDB } = require('./scripts/refreshIGDB');
const { createAssetsFolders } = require('./scripts/createFolders');

const app = express();
const MongoStore = require('connect-mongo');
const isProduction = process.env.NODE_ENV === 'production';


// -----------------------------------------

const origins = isProduction ? process.env.PROD_ORIGINS?.split(',').map(o => o.trim()) || [] : process.env.DEV_ORIGINS?.split(',').map(o => o.trim()) || [];

app.use(cors({
  origin: origins,
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: config.secretKey,
  resave: false,
  saveUninitialized: false,
  store: isProduction
    ? MongoStore.create({ mongoUrl: process.env.MONGO_URI })
    : undefined,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(config.api.games, routesGames);
app.use(config.api.platforms, routesPlatforms);
app.use(config.api.savedatas, routesSaveDatas);
app.use(config.api.comments, routesComments);
app.use(config.api.users, routesUsers);
app.use(config.api.auth, routesAuth);
app.use(config.api.tags, routesTags);
app.use(config.api.assets, routesAssets);

app.use(config.paths.assetsFolder, express.static(path.join(__dirname, 'assets')));

app.all(config.api.api, (req, res) => {
  res.json({ msg: 'GSDB API is running', timestamp: Date.now() });
});

app.all(config.api.api + '/*', async (req, res) => {
  res.status(404).json({
    timestamp: Date.now(),
    msg: 'no route matches your request',
    code: 404
  });
});

connectDB()
  .then(() => {
    console.log('Database connected');


    const port = process.env.PORT;
    app.listen(port, async () => {
      console.log(`Server running on port ${port}`);

      try {
        console.log('Inicializando servidor...');
        createAssetsFolders();
        await refreshIGDB();
        console.log('Datos iniciales refrescados correctamente');
      } catch (err) {
        console.error('Error refrescando datos iniciales:', err);
      }

      setInterval(async () => {
        try {
          await refreshIGDB();
          console.log('Datos refrescados automáticamente');
        } catch (err) {
          console.error('Error refrescando datos automáticamente:', err);
        }
      }, config.refreshInterval);
    });
  })
  .catch(err => {
    console.error('Error conectando a la base de datos:', err);
    process.exit(1);
  });
