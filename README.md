# Cinefy

Cinefy is a Node.js + Express backend API for user authentication and account management. It includes registration, email verification, login, JWT-based access control, refresh-token handling, password reset, and Swagger API documentation.

This project currently focuses on the backend service layer. The movie/music management routes are scaffolded in the project structure but are not implemented in the current codebase.

## Project structure

```text
cinefy/
├── accounts/                    # Account auth flows and database models
│   ├── account.controller.js    # API routes for register/login/reset etc.
│   ├── account.model.js         # Mongoose schema for user/account records
│   ├── account.service.js       # Business logic for auth and account actions
│   ├── refresh-token.model.js   # Refresh token persistence model
│   └── ...
├── _helpers/                    # Shared utilities
│   ├── db.js                    # MongoDB connection + model registry
│   ├── role.js                 # Role constants (Admin/User)
│   ├── send-email.js           # Email sender utility
│   └── swagger.js              # Swagger UI bootstrap
├── _middleware/                 # Express middlewares
│   ├── authorize.js            # JWT authorization checks
│   ├── error-handler.js         # Error response handling
│   └── validate-request.js     # Joi request validation
├── .env.example                # Sample environment variables
├── .gitignore                  # Git ignore rules
├── config.js                   # Loads environment configuration
├── LICENSE                     # Project license
├── package.json                # Project scripts and dependencies
├── server.js                   # Express app bootstrap and route mounting
├── swagger.yaml                # OpenAPI definition for the API
├── README.md                  # Project documentation
├── package-lock.json           # Dependency lock file
└── ...
```

## Tech stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Refresh token rotation
- Joi validation
- Swagger UI
- Nodemailer for email verification and password resets

## Prerequisites

Before running the project, make sure you have:

- Node.js 20.19+ installed
- MongoDB running locally or a reachable MongoDB Atlas connection
- An SMTP provider configured for sending verification/reset emails

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file from the example:

```bash
copy .env.example .env
```

3. Update the values in `.env`:

```env
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
DB_CONN=mongodb://localhost:27017/cinefy
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=no-reply@yourdomain.com
# Optional: enables an Ethereal test account with inbound access
ETHEREAL_API_KEY=your_ethereal_api_key
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
PORT=4000
```

Notes:

- `DB_CONN` (or `MONGODB_URI`) should point to your MongoDB instance.
- Use a unique, random `JWT_SECRET` of at least 32 characters; do not use the example value in production.
- SMTP settings are required so registration verification and password reset emails can be sent.
- Ethereal is for testing: messages are captured instead of delivered to real recipient inboxes. With `SMTP_HOST=smtp.ethereal.email` and `ETHEREAL_API_KEY` set, the app creates a test account through `https://api.nodemailer.com/user` and logs the Ethereal inbox and message-preview URLs. If account creation fails, it logs a warning and tries the configured SMTP credentials. Use a real SMTP provider to deliver to users' inboxes.
- `APP_URL` is optional; when configured it provides trusted frontend links in emails. Without it, the email contains a token to submit to the API.
- `CORS_ORIGINS` is a comma-separated allowlist of frontend origins. Requests without an `Origin` header (such as server-to-server calls) are allowed.
- Set `PORT` to change the HTTP port; the default is `4000`.
- The first account created is automatically assigned the `Admin` role.

## Run the project

Start the API in development mode:

```bash
npm run dev
```

Or run it normally:

```bash
npm start
```

By default, the server runs on:

```text
http://localhost:4000
```

## API overview

The project exposes routes under the `/api/v1/accounts` prefix.

### Authentication and account routes

- `POST /api/v1/accounts/register` — create an account and send a verification email
- `POST /api/v1/accounts/verify-email` — verify a registered account using a token
- `POST /api/v1/accounts/authenticate` — log in and receive a JWT + refresh token cookie
- `POST /api/v1/accounts/refresh-token` — refresh the access token using the refresh token cookie
- `POST /api/v1/accounts/logout` — revoke the refresh token cookie and log out
- `POST /api/v1/accounts/revoke-token` — revoke a refresh token
- `POST /api/v1/accounts/forgot-password` — send a password reset email
- `POST /api/v1/accounts/validate-reset-token` — validate a reset token
- `POST /api/v1/accounts/reset-password` — reset the password
- `GET /api/v1/accounts/me` — get the authenticated account's details
- `GET /api/v1/accounts` — list accounts (admin only)
- `GET /api/v1/accounts/:id` — get account details
- `POST /api/v1/accounts` — create an account (admin only)
- `PUT /api/v1/accounts/:id` — update account
- `DELETE /api/v1/accounts/:id` — delete account

Protected routes require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwtToken>
```

## Swagger / API docs

The OpenAPI docs are available in the browser at:

```text
http://localhost:4000/api-docs
```

This is the easiest way to explore available endpoints and payloads.

## Common usage flow

1. Start MongoDB and the app.
2. Register a new user via `POST /api/v1/accounts/register`.
3. Check the email inbox for the verification link/token.
4. Call `POST /api/v1/accounts/verify-email` with the token.
5. Log in with `POST /api/v1/accounts/authenticate`.
6. Use the returned `jwtToken` in the `Authorization` header for further protected requests.
7. Refresh expired tokens using `POST /api/v1/accounts/refresh-token`.

## Example login request

```bash
curl -X POST http://localhost:4000/api/v1/accounts/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "yourpassword"
  }'
```

## Notes

- The project is currently an API service; there is no frontend app in this repository.
- Movie/music functionality is not yet implemented in the active codebase, although the project is intended to support those modules in the future.
- The first user registered automatically becomes the admin user.

## Troubleshooting

- If the app cannot connect to MongoDB, confirm your `DB_CONN` value and ensure MongoDB is active.
- If email verification/reset emails are not sent, verify the SMTP host, username, password, and port in `.env`. For Ethereal, check the message-preview URL printed by the server, or sign in to the configured SMTP account on the Ethereal Messages page. Ethereal does not deliver to real recipient inboxes.
- If requests return `401 Unauthorized`, confirm the JWT is present and valid.
- If the API route is not found, check that you are calling the correct `/api/v1/accounts/...` path.

## License

This project is licensed under the MIT License.
