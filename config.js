// config.js
require('dotenv').config();

module.exports = {
  connectionString: process.env.DB_CONN,
  secret: process.env.JWT_SECRET,
  emailFrom: process.env.EMAIL_FROM,
  smtpOptions: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
};