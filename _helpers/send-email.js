const config = require('../config');
const nodemailer = require('nodemailer');
const app = require('../package.json');

module.exports = sendEmail;

let transportPromise;

async function sendEmail({ to, subject, html, from }) {
    const { transporter, ethereal } = await getTransport();
    const info = await transporter.sendMail({
        from: from || (ethereal ? ethereal.from : config.emailFrom),
        to,
        subject,
        html
    });

    if (ethereal) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.info(`Ethereal inbox: ${ethereal.inboxUrl}`);
        if (previewUrl) {
            console.info(`Ethereal message preview: ${previewUrl}`);
        }
    }
}

function getTransport() {
    if (!transportPromise) {
        transportPromise = createTransport().catch(error => {
            transportPromise = undefined;
            throw error;
        });
    }
    return transportPromise;
}

async function createTransport() {
    if (config.smtpOptions.host.toLowerCase() === 'smtp.ethereal.email') {
        let etherealAccount;
        if (process.env.ETHEREAL_API_KEY) {
            try {
                etherealAccount = await createEtherealAccount();
            } catch (error) {
                console.warn(
                    `${error.message}; using the configured Ethereal SMTP credentials instead.`
                );
            }
        }

        if (etherealAccount) {
            return {
                transporter: nodemailer.createTransport({
                    host: etherealAccount.smtp.host,
                    port: etherealAccount.smtp.port,
                    secure: etherealAccount.smtp.secure,
                    auth: {
                        user: etherealAccount.user,
                        pass: etherealAccount.pass
                    }
                }),
                ethereal: {
                    from: etherealAccount.user,
                    inboxUrl: etherealAccount.web
                }
            };
        }

        return {
            transporter: nodemailer.createTransport(config.smtpOptions),
            ethereal: {
                from: config.smtpOptions.auth.user,
                inboxUrl: 'https://ethereal.email/messages/'
            }
        };
    }

    return {
        transporter: nodemailer.createTransport(config.smtpOptions),
        ethereal: null
    };
}

async function createEtherealAccount() {
    let response;
    try {
        response = await fetch('https://api.nodemailer.com/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.ETHEREAL_API_KEY}`
            },
            body: JSON.stringify({
                requestor: app.name,
                version: app.version
            })
        });
    } catch (error) {
        throw etherealApiError('Unable to reach the Ethereal account API', error);
    }

    if (!response.ok) {
        throw etherealApiError(`Ethereal account creation failed with HTTP ${response.status}`);
    }

    let account;
    try {
        account = await response.json();
    } catch (error) {
        throw etherealApiError('Ethereal account creation returned invalid JSON', error);
    }

    if (account.status !== 'success' || account.error) {
        throw etherealApiError(`Ethereal account creation failed: ${account.error || 'unsuccessful response'}`);
    }

    if (!account.user || !account.pass || !account.smtp?.host ||
        !Number.isInteger(account.smtp.port) || typeof account.smtp.secure !== 'boolean' ||
        !account.web) {
        throw etherealApiError('Ethereal account creation returned incomplete SMTP account details');
    }

    return account;
}

function etherealApiError(message, cause) {
    const error = new Error(message, cause ? { cause } : undefined);
    error.code = 'ETHEREAL_API_ERROR';
    error.status = 502;
    return error;
}
