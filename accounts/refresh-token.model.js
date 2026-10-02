const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    token: { type: String, required: true, unique: true },
    expires: { type: Date, required: true },
    created: { type: Date, default: Date.now },
    createdByIp: String,
    revoked: Date,
    revokedByIp: String,
    replacedByToken: String
});

schema.virtual('isExpired').get(function () {
    return !this.expires || Date.now() >= this.expires;
});

schema.virtual('isActive').get(function () {
    return !this.revoked && !this.isExpired;
});

schema.index({ account: 1 });
schema.index({ expires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', schema);