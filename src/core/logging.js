const { randomUUID } = require('crypto');

function createLogger(context = {}) {
  function base(level, msg, meta) {
    const entry = {
      level,
      time: new Date().toISOString(),
      msg,
      ...context,
      ...(meta || {}),
    };
    // Simple structured log to stdout
    // Avoid circular JSON issues
    try {
      console.log(JSON.stringify(entry));
    } catch (e) {
      console.log(`[${entry.time}] ${level.toUpperCase()}: ${msg}`);
    }
  }

  return {
    child(extra) {
      return createLogger({ ...context, ...extra });
    },
    info(msg, meta) { base('info', msg, meta); },
    warn(msg, meta) { base('warn', msg, meta); },
    error(msg, meta) { base('error', msg, meta); },
    debug(msg, meta) { base('debug', msg, meta); },
  };
}

function requestIdMiddleware(req, _res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  next();
}

function requestLoggerMiddleware(req, res, next) {
  const logger = createLogger({ requestId: req.requestId, method: req.method, path: req.path });
  req.logger = logger;

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info('request.completed', { status: res.statusCode, durationMs });
  });
  next();
}

module.exports = { createLogger, requestIdMiddleware, requestLoggerMiddleware };


