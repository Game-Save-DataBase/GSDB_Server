// swagger.js
const swaggerJsdoc = require("swagger-jsdoc");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GSDB API",
      version: "0.1.0",
      description: `
# GSDB API Documentation

**Authentication:** To use the API, you must provide an API key as a Bearer token.  
This token can be obtained in your user profile edit page on the website: [User Area](https://gsdb-web.onrender.com/user-area).  
Include it in the header of every request:

\`Authorization: Bearer <API_KEY>\`

For any other information, like how to use query parameters or the different database fields, you can visit the [GSDB Wiki](https://github.com/Game-Save-DataBase/GSDB_Server/wiki)
`
    },
    servers: [
      { url: "/api", description: "API base path" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API_KEY" }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ["./routes/**/*.js"]
};

const swaggerSpec = swaggerJsdoc(options);

// Generate JSON file (for swagger-markdown)
fs.writeFileSync("./swagger.json", JSON.stringify(swaggerSpec, null, 2));

module.exports = (app) => {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
