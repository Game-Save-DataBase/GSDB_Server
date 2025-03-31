const express = require('express');
const connectDB = require('./config/db');
const routesGames = require("./routes/api/games");
const routesSaveDatas = require("./routes/api/savedatas");
const routesComments = require("./routes/api/comments");
const routesUsers = require("./routes/api/users");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require('path'); // Añade esta línea

const app = express();

// use the cors middleware with the
// origin and credentials options
app.use(cors({ origin: true, credentials: true }));

// use the body-parser middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// use the routes module as a middleware
// for the /api/books path
//esto es un include para que las aplicaciones que usen nuestra BBDD puedan acceder a ella por bloqueos de seguridad
app.use("/api/games", routesGames);
app.use("/api/savedatas", routesSaveDatas);
app.use("/api/comments", routesComments);
app.use("/api/users", routesUsers);

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Ruta para comprobar la conexión con la API
app.all('/api', (req, res) => {
    res.json({
      msg: 'GSDB API is running',
      timestamp: Date.now()
    });
  });
// get para gestion de errores cuando no existe la ruta
app.all('/api/*', async (req, res) => {
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
// Configurar carpeta estática para servir archivos
// app.use('/assets', express.static(path.join(__dirname, 'assets', 'uploads')));
// app.use('/uploads', express.static(path.join(__dirname, 'assets', 'uploads'))); 

// Connect Database
connectDB();

app.get('/', (req, res) => res.send('Hello world!'));

const port = process.env.PORT || 8082;

app.listen(port, () => console.log(`Server running on port ${port}`));