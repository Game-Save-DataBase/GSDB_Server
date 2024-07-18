const express = require('express');
const connectDB = require('./config/db');
const routesBooks = require("./routes/api/books");
const routesGames = require("./routes/api/games");
const routesPaths = require("./routes/api/paths");
const routesPlatforms = require("./routes/api/platforms");
const routesSaveDatas = require("./routes/api/savedatas");
const cors = require("cors");
const bodyParser = require("body-parser");

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
app.use("/api/books", routesBooks);
app.use("/api/games", routesGames);
app.use("/api/paths", routesPaths);
app.use("/api/platforms", routesPlatforms);
app.use("/api/savedatas", routesSaveDatas);

// Connect Database
connectDB();

app.get('/', (req, res) => res.send('Hello world!'));

const port = process.env.PORT || 8082;

app.listen(port, () => console.log(`Server running on port ${port}`));