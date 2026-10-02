const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const departments = ['Finance', 'HR', 'Engineering', 'Administration', 'Operation', 'Marketing'];

const schema = new Schema({
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    department: { type: String, enum: departments },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    gender: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    acceptTerms: Boolean,
    role: { type: String, required: true },
    verificationToken: String,
    verified: Date,
    resetToken: {
        token: String,
        expires: Date
    },
    passwordReset: Date,
    created: Date,
    createdAt: {
        type: Date,
        default: function () {
            return this.created || Date.now();
        }
    },
    updated: Date
});

schema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
        delete ret.created;
    }
});

module.exports = mongoose.model('Account', schema);