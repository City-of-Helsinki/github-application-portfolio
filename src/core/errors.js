class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || 'AppError';
    this.status = options.status || 500;
    this.code = options.code || 'APP_ERROR';
    this.details = options.details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', name: 'ValidationError', details });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details) {
    super(message, { status: 404, code: 'NOT_FOUND', name: 'NotFoundError', details });
  }
}

class UpstreamError extends AppError {
  constructor(message, status, details) {
    super(message, { status: status || 502, code: 'UPSTREAM_ERROR', name: 'UpstreamError', details });
  }
}

function errorHandler() {
  return (err, req, res, _next) => {
    const status = err.status || 500;
    const payload = {
      error: {
        name: err.name || 'Error',
        message: err.message || 'Internal Server Error',
        code: err.code || 'INTERNAL',
      }
    };
    if (process.env.NODE_ENV !== 'production' && err.details) {
      payload.error.details = err.details;
    }
    req?.logger?.error('request.error', { status, code: payload.error.code, name: payload.error.name, message: payload.error.message });
    res.status(status).json(payload);
  };
}

module.exports = { AppError, ValidationError, NotFoundError, UpstreamError, errorHandler };


