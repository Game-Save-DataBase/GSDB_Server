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

const app = express();
const MongoStore = require('connect-mongo');
// use the cors middleware with the
// origin and credentials options
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProduction
    ? 'https://gsdb-web.onrender.com' // dominio de tu frontend en producción
    : 'http://localhost:3000',    // frontend en desarrollo
  credentials: true // permite envío de cookies
}))

// use the body-parser middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
if (isProduction) {
  app.set('trust proxy', 1); // confiar en el primer proxy
}
// Sesión
app.use(session({
  secret: config.secretKey,
  resave: false,
  saveUninitialized: false,
  store: isProduction
    ? MongoStore.create({ mongoUrl: process.env.MONGO_URI })
    : undefined, // en dev dejamos el MemoryStore por defecto
  cookie: {
    secure: isProduction,            // true solo en producción (HTTPS)
    sameSite: isProduction ? 'none' : 'lax', // cross-site en prod, lax en dev
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// use the routes module as a middleware
// for the /api/books path
//esto es un include para que las aplicaciones que usen nuestra BBDD puedan acceder a ella por bloqueos de seguridad
app.use(config.api.games, routesGames);
app.use(config.api.platforms, routesPlatforms);
app.use(config.api.savedatas, routesSaveDatas);
app.use(config.api.comments, routesComments);
app.use(config.api.users, routesUsers);
app.use(config.api.auth, routesAuth);
app.use(config.api.tags, routesTags);
app.use(config.api.assets, routesAssets);
app.use(config.paths.assetsFolder, express.static(path.join(__dirname, 'assets')));

// Ruta para comprobar la conexión con la API
app.all(config.api.api, (req, res) => {
  res.json({
    msg: 'GSDB API is running',
    timestamp: Date.now()
  });
});
// get para gestion de errores cuando no existe la ruta
app.all(config.api.api + '/*', async (req, res) => {
  try {
    res.status(404).json({
      timestamp: Date.now(),
      msg: 'no route matches your request',
      code: 404
    })
  } catch (e) {
    throw new Error(e)
  }

})


connectDB()
  .then(() => {
    console.log('Database connected');

    const port = process.env.PORT || 8082;

    // Primero arranca el servidor
    app.listen(port, async () => {
      console.log('Server running on port ${port}');

      // Después llama a refreshIGDB
      try {
        await refreshIGDB();
        console.log('Datos iniciales refrescados correctamente');
      } catch (err) {
        console.error('Error refrescando datos iniciales:', err);
      }

      // Programa que se ejecute refreshIGDB cada X minutos
      setInterval(async () => {
        try {
          await refreshIGDB();
          console.log('Datos refrescados automáticamente');
        } catch (err) {
          console.error('Error refrescando datos automáticamente:', err);
        }
      }, config.refreshInterval); // minutos a milisegundos
    });
  })
  .catch(err => {
    console.error('Error conectando a la base de datos:', err);
    process.exit(1);
  });
