const jwt = require('jsonwebtoken');
const { secret } = require('../config');
const db = require('../_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return async (req, res, next) => {
        const [scheme, token, ...extra] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token || extra.length) {
            return res.status(401).json({ message: 'Missing token' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        } catch {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        try {
            const account = await db.Account.findById(decoded.id);
            if (!account || (roles.length && !roles.includes(account.role))) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const refreshTokens = await db.RefreshToken.find({ account: account.id });
            req.user = {
                id: account.id,
                role: account.role,
                ownsToken: refreshToken => refreshTokens.some(item => item.token === refreshToken)
            };
            return next();
        } catch (error) {
            return next(error);
        }
    };
}
