const config = require('../config');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || config.connectionString);
mongoose.Promise = global.Promise;

module.exports = {
    Account: require('accounts/account.model'),
    RefreshToken: require('accounts/refresh-token.model'),
    isValidId
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}