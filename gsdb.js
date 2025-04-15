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
const routesSaveDatas = require("./routes/api/savedatas");
const routesComments = require("./routes/api/comments");
const routesUsers = require("./routes/api/users");
const routesAuth= require("./routes/api/auth");


const app = express();

// use the cors middleware with the
// origin and credentials options
app.use(cors({ origin: true, credentials: true }));

// use the body-parser middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Configurar sesiones
app.use(
    session({
        secret: config.secretKey,
        resave: false,
        saveUninitialized: false,
        cookie: { 
            //.........IMPORTANTE
            //Esto deberia ser secure: true (https) y samesite: none. En produccion deberia ser asi
            //por ahora lo dejamos asi para usar http y permitir cookies cross-site
            secure: false, 
            sameSite: 'lax'
         } // Cambia a true si usas HTTPS
    })
);
// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());

// use the routes module as a middleware
// for the /api/books path
//esto es un include para que las aplicaciones que usen nuestra BBDD puedan acceder a ella por bloqueos de seguridad
app.use(config.api.games, routesGames);
app.use(config.api.savedatas, routesSaveDatas);
app.use(config.api.comments, routesComments);
app.use(config.api.users, routesUsers);
app.use(config.api.auth, routesAuth);

app.use(config.paths.assetsFolder, express.static(path.join(__dirname, 'assets')));

// Ruta para comprobar la conexión con la API
app.all(config.api.api, (req, res) => {
    res.json({
      msg: 'GSDB API is running',
      timestamp: Date.now()
    });
  });
// get para gestion de errores cuando no existe la ruta
app.all(config.api.api+'/*', async (req, res) => {
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

// Connect Database
connectDB();

app.get('/', (req, res) => res.send('Hello world!'));

const port = process.env.PORT;

app.listen(port, () => console.log(`Server running on port ${port}`));