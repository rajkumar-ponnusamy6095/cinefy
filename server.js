const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config');
const db = require('./_helpers/db');
const errorHandler = require('./_middleware/error-handler');
const morgan = require('morgan');

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use(morgan('tiny'));
app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || config.corsOrigins.includes(origin));
    },
    credentials: true
}));

// api routes
app.use('/api/v1/accounts', require('./accounts/account.controller'));

// swagger docs route
app.use('/api-docs', require('./_helpers/swagger'));

// global error handler
app.use(errorHandler);

async function start() {
    config.validate();
    await db.connect();

    const server = app.listen(config.port, () => {
        console.log(`Server listening on port ${config.port}`);
    });
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.once('listening', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
    } catch (error) {
        await db.disconnect();
        throw error;
    }

    const shutdown = async () => {
        server.close(async error => {
            if (error) {
                console.error('Failed to close HTTP server cleanly:', error);
                process.exitCode = 1;
            }
            try {
                await db.disconnect();
            } catch (disconnectError) {
                console.error('Failed to close MongoDB connection cleanly:', disconnectError);
                process.exitCode = 1;
            }
        });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return server;
}

if (require.main === module) {
    start().catch(error => {
        console.error('Unable to start Cinefy:', error);
        process.exitCode = 1;
    });
}

module.exports = { app, start };