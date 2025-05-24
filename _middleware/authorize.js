const jwt = require('jsonwebtoken');
const { secret } = require('../config');
const db = require('_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({ message: 'Missing token' });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, secret);
            const account = await db.Account.findById(decoded.id);
            const refreshTokens = await db.RefreshToken.find({ account: account.id });

            if (!account || (roles.length && !roles.includes(account.role))) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Attach to req.user
            req.user = {
                id: account.id,
                role: account.role,
                ownsToken: token => !!refreshTokens.find(x => x.token === token)
            };

            next();
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
    };
}