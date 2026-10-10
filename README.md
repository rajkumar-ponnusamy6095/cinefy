# Cinefy

Cinefy is a Node.js + Express backend service for authentication, user account management, and role-based access control. The current codebase focuses on the identity layer needed by a movie/music platform, with media catalog endpoints planned for future work.

## Current implementation

The API includes:

- account registration with email verification
- secure login and logout flows
- JWT access tokens with refresh-token rotation
- password reset and change-password flows (passwords need at least 8 characters; reset links expire after 15 minutes)
- admin and user role checks; inactive accounts cannot log in or refresh tokens
- MongoDB-backed persistence with Mongoose
- Swagger API docs
- request validation and centralized error handling

## Tech stack

- Node.js 20+
- Express.js
- MongoDB + Mongoose
- JWT authentication
- Refresh token rotation
- Joi validation
- Swagger UI
- Nodemailer

## Repository layout

```text
cinefy/
├── accounts/                       # Account and auth endpoints
│   ├── account.controller.js       # Express routes and Joi validation
│   ├── account.model.js            # Mongoose account schema
│   ├── account.service.js          # Business logic for auth/account flows
│   ├── refresh-token.model.js     # Refresh token persistence
│   └── ...
├── _helpers/                       # Shared utilities
│   ├── db.js                      # MongoDB connection and model registry
│   ├── role.js                    # Role constants
│   ├── send-email.js              # Email delivery helper
│   └── swagger.js                 # Swagger UI bootstrap
├── _middleware/                    # Route guards and request helpers
│   ├── authorize.js               # Bearer JWT enforcement
│   ├── error-handler.js           # Centralized error responses
│   └── validate-request.js        # Request validation wrapper
├── scripts/                       # Utility scripts
│   ├── seed-admin-users.js         # Seed five admin accounts
│   └── seed-pagination-users.js    # Seed sample paginated user accounts
├── tests/                         # Node test suite
├── .env.example                   # Sample environment config
├── .gitignore                     # Git ignore rules
├── config.js                      # Config loader and validation
├── LICENSE                        # MIT license
├── package.json                   # Scripts and dependencies
├── server.js                      # App bootstrap and route mounting
├── swagger.yaml                   # OpenAPI specification
├── README.md                      # Project documentation
├── package-lock.json              # Dependency lock file
└── ...
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 20.19+ installed
- MongoDB running locally or a reachable MongoDB Atlas instance
- An SMTP provider or Ethereal account for verification and reset emails

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

3. Update the values in `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=no-reply@example.com
SMTP_PORT=587
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
DB_CONN=mongodb://localhost:27017/cinefy
DB_MAX_POOL_SIZE=100
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
PORT=4000
```

Notes:

- `DB_CONN` and `MONGODB_URI` are both accepted by the app; `MONGODB_URI` takes precedence when present.
- `JWT_SECRET` must be at least 32 characters long.
- `APP_URL` is optional but recommended for email links and front-end redirects.
- `CORS_ORIGINS` is a comma-separated allowlist of frontend origins.
- The first account created is automatically assigned the `Admin` role.
- `SMTP_HOST=smtp.ethereal.email` is useful for testing email flows without sending messages to real inboxes.

## Run the project

Start the API in development mode:

```bash
npm run dev
```

Or run it directly:

```bash
npm start
```

By default the server listens on:

```text
http://localhost:4000
```

## Available scripts

```bash
npm run dev
npm start
npm test
npm run seed:users
npm run seed:admins
```

- `npm run dev` starts the server with nodemon for local development.
- `npm start` starts the Express app in production mode.
- `npm test` runs the project test suite using Node's built-in test runner.
- `npm run seed:users` fills the database with sample paginated user accounts.
- `npm run seed:admins` creates or updates Arun Kumar, Priya Sharma, Vikram Rajan, Sneha Iyer, and Karthik Prasad as admin accounts with `firstname@test.com` emails and `firstname@123` passwords. Use only in a trusted development or test database.

## API overview

The app exposes account routes under the `/api/v1/accounts` prefix.

### Authentication and account routes

- `POST /api/v1/accounts/register` — create an account and send a verification email
- `POST /api/v1/accounts/verify-email` — verify a registered account with a token
- `POST /api/v1/accounts/authenticate` — log in and receive a JWT plus an HTTP-only refresh token cookie
- `POST /api/v1/accounts/refresh-token` — rotate the refresh token and return a new JWT
- `POST /api/v1/accounts/logout` — revoke the current refresh token and clear the cookie
- `POST /api/v1/accounts/revoke-token` — revoke a refresh token
- `POST /api/v1/accounts/forgot-password` — send a password reset email
- `POST /api/v1/accounts/validate-reset-token` — validate a reset token
- `POST /api/v1/accounts/reset-password` — reset the password
- `POST /api/v1/accounts/change-password` — change the authenticated account password
- `GET /api/v1/accounts/me` — fetch the current authenticated account
- `GET /api/v1/accounts` — list accounts (admin only)
- `GET /api/v1/accounts/:id` — get an account by id
- `POST /api/v1/accounts` — create an account (admin only)
- `PUT /api/v1/accounts/:id` — update an account
- `DELETE /api/v1/accounts/:id` — delete an account

Protected routes require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt>
```

For large account collections, the service supports keyset pagination:

```text
GET /api/v1/accounts?pagination=cursor&limit=100
GET /api/v1/accounts?pagination=cursor&limit=100&afterId=<nextCursor>
```

Continue while `pagination.hasMore` is `true`, passing `pagination.nextCursor` as `afterId`.

## Swagger documentation

Open the Swagger UI in a browser at:

```text
http://localhost:4000/api-docs
```

## Common usage flow

1. Start MongoDB and the API.
2. Register a new account with `POST /api/v1/accounts/register`.
3. Verify the account using the email link or verification token.
4. Log in with `POST /api/v1/accounts/authenticate`.
5. Use the returned `jwtToken` in the `Authorization` header for protected requests.
6. Refresh tokens using `POST /api/v1/accounts/refresh-token` when they expire.

## Example requests

### Register

```bash
curl -X POST http://localhost:4000/api/v1/accounts/register \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "Male",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "user@example.com",
    "phone": "+1-555-123-4567",
    "department": "Engineering",
    "password": "yourpassword",
    "confirmPassword": "yourpassword",
    "acceptTerms": true
  }'
```

### Login

```bash
curl -X POST http://localhost:4000/api/v1/accounts/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "yourpassword"
  }'
```

### Protected request

```bash
curl -X GET http://localhost:4000/api/v1/accounts/me \
  -H "Authorization: Bearer <jwt>
```

## Notes

- This repository contains the backend API only; there is no frontend application in the current codebase.
- Movie and music functionality is not implemented in the active app, although the project is intended to support those modules in the future.
- The first user registered automatically becomes the admin user.

## Troubleshooting

- If MongoDB cannot connect, verify your `DB_CONN` or `MONGODB_URI` value and make sure the database is running.
- If verification or password-reset emails are not sent, confirm your SMTP configuration in `.env`.
- If requests return `401 Unauthorized`, check that the `Authorization` header contains a valid Bearer token.
- If requests return `403 Forbidden`, the token is valid but the account lacks the required role or is not the owner of the target account.
- If the route is missing, confirm you are hitting the correct `/api/v1/accounts/...` endpoint.

## License

This project is licensed under the MIT License.
