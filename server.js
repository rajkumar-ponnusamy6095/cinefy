require('rootpath')();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');
const morgan = require('morgan');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(morgan('tiny'));
// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// api routes
app.use('/api/v1/accounts', require('./accounts/account.controller'));
// app.use('/api/v1/languages', require('./languages/languages.controller'));
// app.use('/api/v1/directors', require('./directors/directors.controller'));
// app.use('/api/v1/music-directors', require('./music-directors/music-directors.controller'));
// app.use('/api/v1/movies', require('./movies/movies.controller'));

// swagger docs route
app.use('/api-docs', require('_helpers/swagger'));

// global error handler
app.use(errorHandler);

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => {
    console.log('Server listening on port ' + port);
});