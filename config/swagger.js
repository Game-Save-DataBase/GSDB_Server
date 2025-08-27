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

**Query parameters for GET /search:**  
All basic GET endpoints and /search allow query parameters in the form:

\`?field[operator]=value\`  
or for array operators:  
\`?field[operator]=value1,value2,value3\`  

**Operators:**  
- gt: $gt (greater than)  
- gte: $gte (greater than or equal)  
- lt: $lt (less than)  
- lte: $lte (less than or equal)  
- eq: $eq (equals)  
- ne: $ne (not equals)  
- like: $regex (contains)  
- start: $regex (starts with)  
- end: $regex (ends with)  
- in: $in (in array)  
- nin: $nin (not in array)
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
