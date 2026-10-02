const config = require('../config');
const mongoose = require('mongoose');

module.exports = {
    Account: require('../accounts/account.model'),
    RefreshToken: require('../accounts/refresh-token.model'),
    connect,
    disconnect,
    isValidId
};

function connect() {
    return mongoose.connect(config.connectionString, {
        maxPoolSize: config.dbMaxPoolSize
    });
}

function disconnect() {
    return mongoose.disconnect();
}

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}