module.exports = errorHandler;

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    switch (true) {
        case typeof err === 'string': {
            const statusCode = err.toLowerCase().endsWith('not found') ? 404 : 400;
            return res.status(statusCode).json({ message: err });
        }
        case err.code === 'ETHEREAL_API_ERROR':
            console.error(err);
            return res.status(502).json({ message: err.message });
        case err.status >= 400 && err.status < 500:
            return res.status(err.status).json({ message: err.message });
        case err.name === 'ValidationError':
        case err.name === 'CastError':
            return res.status(400).json({ message: err.message });
        case err.code === 11000:
            return res.status(409).json({ message: 'An account with this email already exists' });
        case err.name === 'UnauthorizedError':
            return res.status(401).json({ message: 'Unauthorized' });
        default:
            console.error(err);
            return res.status(500).json({ message: 'An unexpected error occurred' });
    }
}
