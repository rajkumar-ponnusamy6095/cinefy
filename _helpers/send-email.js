const nodemailer = require('nodemailer');
const config = require('../config');
const transporter = nodemailer.createTransport(config.smtpOptions);

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.emailFrom }) {
    await transporter.sendMail({ from, to, subject, html });
}