const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API routes to Chat API server (includes RAG service)
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3006',
      changeOrigin: true,
      secure: false,
      logLevel: 'silent'
    })
  );
};