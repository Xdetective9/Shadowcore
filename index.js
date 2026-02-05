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

// IMPORTANT: Render needs dynamic port binding
const PORT = process.env.PORT || 10000; // Render uses 10000
const HOST = '0.0.0.0'; // Bind to all interfaces

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

// Session setup - MemoryStore for simplicity
app.use(session({
  store: process.env.NODE_ENV === 'production' ? 
    new SQLiteStore({
      dir: './database',
      db: 'sessions.db'
    }) : undefined,
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

// ========== BASIC ROUTES (For health check) ==========
app.get('/', (req, res) => {
  res.json({ 
    status: 'ShadowCore is running',
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========== LOAD OTHER ROUTES ==========
async function loadRoutes() {
  try {
    // Load auth routes
    const authRoutes = require('./routes/auth');
    app.use('/', authRoutes);
    logger.info('Loaded auth routes');
    
    // Load admin routes
    const adminRoutes = require('./routes/admin');
    app.use('/', adminRoutes);
    logger.info('Loaded admin routes');
    
    // Load main routes
    const mainRoutes = require('./routes/index');
    app.use('/', mainRoutes);
    logger.info('Loaded main routes');
    
  } catch (err) {
    logger.warn('Some routes failed to load:', err.message);
  }
}

// ========== ERROR HANDLING ==========
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
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
    const server = app.listen(PORT, HOST, () => {
      const address = server.address();
      console.log(chalk.green(`
╔══════════════════════════════════════════════════════════╗
║                🚀 SHADOWCORE v3.0                       ║
╠══════════════════════════════════════════════════════════╣
║ 📍 Server: ${HOST}:${address.port}                      ║
║ 🌐 Environment: ${process.env.NODE_ENV || 'development'} ║
║ 📦 Plugins: ${global.plugins.size} loaded               ║
║ 🗄️ Database: SQLite (shadowcore.db)                    ║
╠══════════════════════════════════════════════════════════╣
║                ✅ SYSTEM OPERATIONAL                    ║
╚══════════════════════════════════════════════════════════╝
      `));
    });
    
    // Handle Render's port detection
    server.on('listening', () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    // Don't exit, try to start basic server
    app.listen(PORT, HOST, () => {
      console.log(`✅ Basic server started on port ${PORT}`);
    });
  }
}

// Export for Vercel
module.exports = app;

// Start server if not in Vercel
if (require.main === module) {
  startServer();
}
