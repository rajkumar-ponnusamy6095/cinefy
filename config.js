require('dotenv').config();

const smtpPort = Number(process.env.SMTP_PORT || 587);
const dbMaxPoolSize = Number(process.env.DB_MAX_POOL_SIZE || 100);

module.exports = {
    connectionString: process.env.MONGODB_URI || process.env.DB_CONN,
    dbMaxPoolSize,
    secret: process.env.JWT_SECRET,
    emailFrom: process.env.EMAIL_FROM,
    appUrl: process.env.APP_URL,
    corsOrigins: (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
    smtpOptions: {
        host: process.env.SMTP_HOST,
        port: smtpPort,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },
    port: Number(process.env.PORT || 4000),
    validate() {
        const required = {
            DB_CONN: this.connectionString,
            JWT_SECRET: this.secret,
            SMTP_HOST: this.smtpOptions.host,
            SMTP_USER: this.smtpOptions.auth.user,
            SMTP_PASS: this.smtpOptions.auth.pass,
            EMAIL_FROM: this.emailFrom
        };
        const missing = Object.entries(required)
            .filter(([, value]) => !value)
            .map(([name]) => name);

        if (missing.length) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        if (this.secret.length < 32) {
            throw new Error('JWT_SECRET must contain at least 32 characters');
        }
        if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
            throw new Error('SMTP_PORT must be an integer between 1 and 65535');
        }
        if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) {
            throw new Error('PORT must be an integer between 1 and 65535');
        }
        if (!Number.isInteger(this.dbMaxPoolSize) || this.dbMaxPoolSize < 1) {
            throw new Error('DB_MAX_POOL_SIZE must be a positive integer');
        }
        if (this.appUrl) {
            try {
                const url = new URL(this.appUrl);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error();
                }
            } catch {
                throw new Error('APP_URL must be a valid HTTP or HTTPS URL');
            }
        }
    }
};