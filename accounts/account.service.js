const config = require("../config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const sendEmail = require("../_helpers/send-email");
const db = require("../_helpers/db");
const Role = require("../_helpers/role");

const basicDetailsFields = [
  "gender",
  "firstName",
  "lastName",
  "email",
  "phone",
  "department",
  "status",
  "role",
  "createdAt",
  "updated",
  "verified",
  "passwordReset",
].join(" ");

module.exports = {
  authenticate,
  refreshToken,
  logout,
  revokeToken,
  register,
  verifyEmail,
  forgotPassword,
  validateResetToken,
  resetPassword,
  changePassword,
  getAll,
  getById,
  create,
  update,
  delete: _delete,
};

async function authenticate({ email, password, ipAddress }) {
  const account = await db.Account.findOne({ email });

  if (
    !account ||
    !account.isVerified ||
    !(await bcrypt.compare(password, account.passwordHash))
  ) {
    throw "Email or password is incorrect";
  }

  // authentication successful so generate jwt and refresh tokens
  const jwtToken = generateJwtToken(account);
  const refreshToken = generateRefreshToken(account, ipAddress);

  // save refresh token
  await refreshToken.save();

  // Return only the email and access token; the refresh token is sent as a cookie.
  return {
    email: account.email,
    jwtToken,
    refreshToken: refreshToken.token,
  };
}

async function refreshToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);
  const { account } = refreshToken;
  if (!account) throw "Invalid token";

  // replace old refresh token with a new one and save
  const newRefreshToken = generateRefreshToken(account, ipAddress);
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  refreshToken.replacedByToken = newRefreshToken.token;
  await refreshToken.save();
  await newRefreshToken.save();

  // generate new jwt
  const jwtToken = generateJwtToken(account);

  // Return only the email and access token; the refresh token is sent as a cookie.
  return {
    email: account.email,
    jwtToken,
    refreshToken: newRefreshToken.token,
  };
}

async function revokeToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);

  // revoke token and save
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
}

async function logout({ token, ipAddress }) {
  if (!token) return;

  const refreshToken = await db.RefreshToken.findOne({ token });
  if (!refreshToken || !refreshToken.isActive) return;

  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
}

async function register(params, origin) {
  // validate
  if (await db.Account.findOne({ email: params.email })) {
    // send already registered error in email to prevent account enumeration
    return sendAlreadyRegisteredEmail(params.email, origin);
  }

  // create account object
  const account = new db.Account(params);

  // first registered account is an admin
  const isFirstAccount = (await db.Account.countDocuments({})) === 0;
  account.role = isFirstAccount ? Role.Admin : Role.User;
  account.verificationToken = randomTokenString();

  // hash password
  account.passwordHash = await hash(params.password);

  // save account
  await account.save();

  // send email
  await sendVerificationEmail(account, origin);
}

async function verifyEmail({ token }) {
  const account = await db.Account.findOne({ verificationToken: token });

  if (!account) throw "Verification failed";

  account.verified = Date.now();
  account.verificationToken = undefined;
  await account.save();
}

async function forgotPassword({ email }, origin) {
  const account = await db.Account.findOne({ email });

  // always return ok response to prevent email enumeration
  if (!account) return;

  // create reset token that expires after 24 hours
  account.resetToken = {
    token: randomTokenString(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
  await account.save();

  // send email
  await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
  const account = await db.Account.findOne({
    "resetToken.token": token,
    "resetToken.expires": { $gt: Date.now() },
  });

  if (!account) throw "Invalid token";
}

async function resetPassword({ token, password }) {
  const account = await db.Account.findOne({
    "resetToken.token": token,
    "resetToken.expires": { $gt: Date.now() },
  });

  if (!account) throw "Invalid token";

  // update password and remove reset token
  account.passwordHash = await hash(password);
  account.passwordReset = Date.now();
  account.resetToken = undefined;
  await account.save();
  await db.RefreshToken.deleteMany({ account: account.id });
}

async function changePassword({ id, oldPassword, newPassword }) {
  const account = await getAccount(id);

  if (!(await bcrypt.compare(oldPassword, account.passwordHash))) {
    throw "Old password is incorrect";
  }

  account.passwordHash = await hash(newPassword);
  account.updated = Date.now();
  await account.save();
  await db.RefreshToken.deleteMany({ account: account.id });
}

async function getAll({
  search,
  role,
  status,
  department,
  sortBy = "id",
  sortOrder = "asc",
  page = 1,
  pagination = "page",
  afterId,
  limit = 10,
} = {}) {
  const sortableFields = {
    id: "_id",
    gender: "gender",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    phone: "phone",
    department: "department",
    status: "status",
    role: "role",
    createdAt: "createdAt",
    updated: "updated",
  };
  const sortField =
    Object.prototype.hasOwnProperty.call(sortableFields, sortBy) &&
    sortableFields[sortBy];
  if (!sortField) {
    const error = new Error(`Invalid sort field: ${sortBy}`);
    error.status = 400;
    throw error;
  }

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const pageSize = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit) || 10, 1), 100)
    : requestedLimit === Infinity
      ? 100
      : 10;
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / pageSize);
  const pageNumber = Math.min(
    Number.isFinite(requestedPage)
      ? Math.max(Math.floor(requestedPage) || 1, 1)
      : 1,
    maxPage,
  );
  const filter = {};

  if (search) {
    const searchPattern = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(searchPattern, "i");
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { department: searchRegex },
      { phone: searchRegex },
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ["$firstName", " ", "$lastName"] },
            regex: searchPattern,
            options: "i",
          },
        },
      },
    ];
  }

  if (role) filter.role = String(role);
  if (status) filter.status = String(status);
  if (department) filter.department = String(department);

  const sortDirection = sortOrder === "desc" ? -1 : 1;
  if (!["page", "cursor"].includes(pagination)) {
    const error = new Error('pagination must be "page" or "cursor"');
    error.status = 400;
    throw error;
  }
  if (afterId !== undefined && pagination !== "cursor") {
    const error = new Error("afterId requires cursor pagination");
    error.status = 400;
    throw error;
  }

  if (pagination === "cursor") {
    if (sortBy !== "id") {
      const error = new Error("Cursor pagination only supports sorting by id");
      error.status = 400;
      throw error;
    }
    if (afterId !== undefined && !db.isValidId(afterId)) {
      const error = new Error("afterId must be a valid account id");
      error.status = 400;
      throw error;
    }

    if (afterId !== undefined) {
      filter._id = { [sortDirection === 1 ? "$gt" : "$lt"]: afterId };
    }
    const accounts = await db.Account.find(filter)
      .sort({ _id: sortDirection })
      .limit(pageSize + 1)
      .select(basicDetailsFields)
      .lean();
    const hasMore = accounts.length > pageSize;
    const pageAccounts = hasMore ? accounts.slice(0, pageSize) : accounts;

    return {
      data: pageAccounts.map((account) => basicDetails(account)),
      pagination: {
        limit: pageSize,
        hasMore,
        nextCursor: hasMore
          ? pageAccounts[pageAccounts.length - 1]._id.toString()
          : null,
      },
    };
  }

  const offset = (pageNumber - 1) * pageSize;
  const [accounts, total] = await Promise.all([
    db.Account.find(filter)
      .sort({ [sortField]: sortDirection })
      .skip(offset)
      .limit(pageSize)
      .select(basicDetailsFields)
      .lean(),
    db.Account.countDocuments(filter),
  ]);

  return {
    data: accounts.map((x) => basicDetails(x)),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function getById(id) {
  if (!db.isValidId(id)) throw "Account not found";
  const account = await db.Account.findById(id)
    .select(basicDetailsFields)
    .lean();
  if (!account) throw "Account not found";
  return basicDetails(account);
}

async function create(params, origin) {
  // validate
  if (await db.Account.findOne({ email: params.email })) {
    throw 'Email "' + params.email + '" is already registered';
  }

  const account = new db.Account(params);
  account.resetToken = {
    token: randomTokenString(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  // Keep a non-usable password hash until the account owner sets their password.
  account.passwordHash = await hash(randomTokenString());

  // save account
  await account.save();

  // Ask the account owner to set a password before they can sign in.
  await sendPasswordSetupEmail(account, origin);

  return basicDetails(account);
}

async function update(id, params) {
  const account = await getAccount(id);

  // validate (if email was changed)
  if (
    params.email &&
    account.email !== params.email &&
    (await db.Account.findOne({ email: params.email }))
  ) {
    throw 'Email "' + params.email + '" is already taken';
  }

  // hash password if it was entered
  if (params.password) {
    params.passwordHash = await hash(params.password);
  }

  // copy params to account and save
  Object.assign(account, params);
  account.updated = Date.now();
  await account.save();
  if (params.password) {
    await db.RefreshToken.deleteMany({ account: account.id });
  }

  return basicDetails(account);
}

async function _delete(id) {
  const account = await getAccount(id);
  await db.RefreshToken.deleteMany({ account: account.id });
  await account.deleteOne();
}

// helper functions

async function getAccount(id) {
  if (!db.isValidId(id)) throw "Account not found";
  const account = await db.Account.findById(id);
  if (!account) throw "Account not found";
  return account;
}

async function getRefreshToken(token) {
  if (!token) throw "Invalid token";
  const refreshToken = await db.RefreshToken.findOne({ token }).populate(
    "account",
  );
  if (!refreshToken || !refreshToken.isActive) throw "Invalid token";
  return refreshToken;
}

function hash(password) {
  return bcrypt.hash(password, 12);
}

function generateJwtToken(account) {
  // create a jwt token containing the account id that expires in 15 minutes
  return jwt.sign({ sub: account.id, id: account.id }, config.secret, {
    expiresIn: "15m",
  });
}

function generateRefreshToken(account, ipAddress) {
  // create a refresh token that expires in 7 days
  return new db.RefreshToken({
    account: account.id,
    token: randomTokenString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress,
  });
}

function randomTokenString() {
  return crypto.randomBytes(40).toString("hex");
}

function basicDetails(account) {
  const {
    gender,
    firstName,
    lastName,
    email,
    phone,
    department,
    status,
    role,
    createdAt,
    updated,
  } = account;
  return {
    id: account.id || account._id.toString(),
    gender,
    firstName,
    lastName,
    email,
    phone,
    department,
    status,
    role,
    createdAt,
    updated,
    isVerified:
      account.isVerified ?? Boolean(account.verified || account.passwordReset),
  };
}

async function sendVerificationEmail(account, origin) {
  let message;
  if (config.appUrl?.length) {
    if (!origin || !config.appUrl.includes(origin)) {
      throw new Error("Invalid application origin");
    }
    const verifyUrl = new URL("/account/verify-email", origin);
    verifyUrl.searchParams.set("token", account.verificationToken);
    message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl.href}">${verifyUrl.href}</a></p>`;
  } else {
    message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: "Cinefy - Verify Email",
    html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`,
  });
}

async function sendAlreadyRegisteredEmail(email, origin) {
  let message;
  if (config.appUrl?.length) {
    if (!origin || !config.appUrl.includes(origin)) {
      throw new Error("Invalid application origin");
    }
    const forgotPasswordUrl = new URL(
      "/account/forgot-password",
      origin,
    );
    message = `<p>If you don't know your password please visit the <a href="${forgotPasswordUrl.href}">forgot password</a> page.</p>`;
  } else {
    message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
  }

  await sendEmail({
    to: email,
    subject: "Cinefy - Email Already Registered",
    html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${escapeHtml(email)}</strong> is already registered.</p>
               ${message}`,
  });
}

async function sendPasswordResetEmail(account, origin) {
  let message;
   if (config.appUrl?.length) {
    if (!origin || !config.appUrl.includes(origin)) {
      throw new Error("Invalid application origin");
    }
    const resetUrl = new URL("/account/reset-password", origin);
    resetUrl.searchParams.set("token", account.resetToken.token);
    message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl.href}">${resetUrl.href}</a></p>`;
  } else {
    message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken.token}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: "Cinefy - Reset Password",
    html: `<h4>Reset Password Email</h4>
               ${message}`,
  });
}

async function sendPasswordSetupEmail(account, origin) {
  let message;
  if (config.appUrl?.length) {
    if (!origin || !config.appUrl.includes(origin)) {
      throw new Error("Invalid application origin");
    }
    const setPasswordUrl = new URL("/account/reset-password", origin);
    setPasswordUrl.searchParams.set("token", account.resetToken.token);
    message = `<p>Please click the link below to set your password. The link is valid for 1 day:</p>
                   <p><a href="${setPasswordUrl.href}">${setPasswordUrl.href}</a></p>`;
  } else {
    message = `<p>Please use the token below to set your password with the <code>/account/reset-password</code> API route. The token is valid for 1 day:</p>
                   <p><code>${account.resetToken.token}</code></p>`;
  }

  await sendEmail({
    to: account.email,
    subject: "Cinefy - Set Password",
    html: `<h4>Set Your Password</h4>
               <p>An account has been created for you.</p>
               ${message}`,
  });
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
