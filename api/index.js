let app;
let initError = null;

try {
  app = require('../backend/src/app');
} catch (err) {
  console.error('CRITICAL: Failed to load Express app in api/index.js:', err);
  initError = err;
}

module.exports = (req, res) => {
  if (initError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: false,
      errorType: 'SERVERLESS_COLD_START_ERROR',
      message: 'Serverless initialization failed: ' + initError.message,
      stack: initError.stack
    }, null, 2));
  }

  return app(req, res);
};
