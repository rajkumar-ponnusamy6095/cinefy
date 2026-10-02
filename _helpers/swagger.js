const express = require('express');
const router = express.Router();
const path = require('node:path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname, '..', 'swagger.yaml'));

router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

module.exports = router;