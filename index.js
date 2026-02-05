require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create app
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create necessary directories
async function createDirectories() {
  const dirs = [
    'public/uploads',
    'public/assets',
    'plugins',
    'logs',
    'temp',
    'database'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(path.join(__dirname, dir), { recursive: true });
      logger.info(`Created directory: ${dir}`);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        logger.error(`Failed to create directory ${dir}:`, err);
      }
    }
  }
}

// Global variables
global.plugins = new Map();
global.pluginRoutes = [];
global.pluginMiddlewares = [];
global.pluginSockets = [];

// ========== MIDDLEWARE SETUP ==========
app.use(require('helmet')());
app.use(require('cors')());
app.use(require('compression')());
app.use(require('morgan')('dev'));
app.use(require('cookie-parser')());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(require('express-fileupload')({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }
}));

// Rate limiting
app.use(require('express-rate-limit')({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP'
}));

// Session setup
app.use(session({
  store: new SQLiteStore({
    dir: './database',
    db: 'sessions.db'
  }),
  secret: process.env.SESSION_SECRET || 'shadowcore-secret-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'plugins/views')
]);

// Static files
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: '1y'
}));
app.use('/plugins/static', express.static(path.join(__dirname, 'plugins/public'), {
  maxAge: '1y'
}));

// Database initialization
const { initDatabase, db } = require('./utils/database');

// Plugin Loader
const PluginLoader = require('./utils/plugin-manager');
const pluginLoader = new PluginLoader(app);

// ========== LOAD CORE ROUTES ==========
async function loadRoutes() {
  const routeFiles = ['index', 'auth', 'admin', 'plugins', 'api', 'love'];
  
  for (const file of routeFiles) {
    try {
      const routePath = path.join(__dirname, 'routes', `${file}.js`);
      await fs.access(routePath);
      const route = require(routePath);
      app.use('/', route);
      logger.info(`Loaded route: ${file}`);
    } catch (err) {
      logger.warn(`Route file ${file}.js not found, skipping`);
    }
  }
}

// ========== ERROR HANDLING ==========
app.use((req, res, next) => {
  res.status(404).render('errors/404', {
    title: '404 - Page Not Found',
    message: 'The page you\'re looking for doesn\'t exist.'
  });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(err.status || 500).render('errors/500', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ========== SOCKET.IO SETUP ==========
const server = require('http').createServer(app);
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  // Handle plugin socket events
  global.pluginSockets.forEach(event => {
    if (typeof event === 'function') {
      event(socket, io);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ========== START SERVER ==========
async function startServer() {
  try {
    // Create directories
    await createDirectories();
    
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');
    
    // Load plugins
    await pluginLoader.loadAllPlugins();
    logger.info(`Loaded ${global.plugins.size} plugins`);
    
    // Load routes
    await loadRoutes();
    
    // Start server
    server.listen(PORT, HOST, () => {
      console.log(chalk.green(`
╔══════════════════════════════════════════════════════════╗
║                🚀 SHADOWCORE v3.0                       ║
╠══════════════════════════════════════════════════════════╣
║ 📍 Server: ${HOST}:${PORT}                              ║
║ 🌐 Environment: ${process.env.NODE_ENV || 'development'} ║
║ 📦 Plugins: ${global.plugins.size} loaded               ║
║ 🗄️ Database: SQLite (shadowcore.db)                    ║
╠══════════════════════════════════════════════════════════╣
║                ✅ SYSTEM OPERATIONAL                    ║
╚══════════════════════════════════════════════════════════╝

👤 Owner: ${process.env.OWNER_NAME || 'Abdullah'}
📧 Contact: ${process.env.OWNER_EMAIL || ''}
🔗 Home: http://${HOST}:${PORT}
🔐 Admin: /admin/login
🧩 Plugins: /plugins
📱 Dashboard: /dashboard
❤️ Special: /love/anushay
      `));
    });
    
    // Auto-recover on crash
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      // Don't crash, try to recover
      setTimeout(() => {
        logger.info('Attempting recovery...');
      }, 5000);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing
module.exports = { app, server, io };

// Start the server
if (require.main === module) {
  startServer();
}
