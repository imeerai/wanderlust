class ExpressError extends Error {
  constructor(status, message) {
      super();
      this.message = message;
      this.status = status;
  }
}

exports = module.exports = ExpressError;