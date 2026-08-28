/* eslint-disable no-unused-vars */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, _req, res, _next) {
  // Drive/gaxios failures carry their status on err.response.
  const code = Number(err.status) || Number(err.response?.status) || 500;

  // Google API errors arrive with a nested response - surface something useful
  // in the terminal during the demo, but keep the client payload generic.
  console.error('[error]', err.message);
  if (err.response?.data) console.error('[error] drive:', err.response.data);

  if (res.headersSent) return res.destroy();
  res.status(code).json({ error: err.message || 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
