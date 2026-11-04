// Server-side rules for sign-up. The browser shows the same rules live,
// but only these checks are trusted.
const USERNAME_RE = /^[a-z0-9._]{4,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordError = (password) => {
  if (password.length < 8) return "Use at least 8 characters";
  if (password.length > 128) return "Use 128 characters or fewer";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include letters and a number";
  if (!/[\W_]/.test(password)) return "Include one symbol (e.g. ! @ #)";
  return "";
};

const str = (v) => (typeof v === "string" ? v : "");

// Returns { values, errors }. `errors` is empty when everything is valid.
module.exports.validateSignup = (input) => {
  const src = input && typeof input === "object" ? input : {};
  const username = str(src.username).trim();
  const email = str(src.email).trim().toLowerCase();
  const password = str(src.password);
  const errors = {};

  if (!USERNAME_RE.test(username)) {
    errors.username = "Use 4 to 30 characters: lowercase letters, numbers, . or _";
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address";
  }
  const pwErr = passwordError(password);
  if (pwErr) errors.password = pwErr;

  return { values: { username, email, password }, errors };
};

// Only allow same-site paths as a post-login destination (blocks open redirects).
module.exports.safeReturnTo = (url) =>
  typeof url === "string" && /^\/(?![\/\\])/.test(url) && url.length < 500 ? url : "/listings";

module.exports.passwordError = passwordError;
module.exports.USERNAME_RE = USERNAME_RE;
module.exports.EMAIL_RE = EMAIL_RE;
module.exports.str = str;
