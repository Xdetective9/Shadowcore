// Vercel Serverless Entry Point
const app = require('./index');

// Export for Vercel
module.exports = async (req, res) => {
  // Check if it's a static file request
  if (req.url.startsWith('/static/') || req.url.startsWith('/plugins/static/')) {
    // Let Vercel handle static files
    return res.status(404).end();
  }
  
  // Handle API requests
  return app(req, res);
};
