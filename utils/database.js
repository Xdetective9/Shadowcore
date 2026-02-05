const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../database/shadowcore.db');
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

const db = new Database();

async function initDatabase() {
  await db.connect();
  
  // Create tables
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      description TEXT,
      enabled BOOLEAN DEFAULT 1,
      config TEXT DEFAULT '{}',
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS plugin_deps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plugin_id INTEGER,
      dependency TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (plugin_id) REFERENCES plugins (id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      expires DATETIME,
      data TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      type TEXT DEFAULT 'string',
      category TEXT DEFAULT 'general'
    )
  `);

  // Insert default admin user if not exists
  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ShadowCore@2024', 10);
    await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['admin', process.env.OWNER_EMAIL || 'admin@shadowcore.com', hashedPassword, 'admin']
    );
    console.log('✅ Created default admin user');
  }

  // Insert default settings
  const defaultSettings = [
    ['site_name', 'ShadowCore', 'string', 'general'],
    ['site_description', 'Advanced Modular Platform', 'string', 'general'],
    ['theme', 'dark', 'string', 'appearance'],
    ['maintenance_mode', '0', 'boolean', 'system'],
    ['max_upload_size', '50', 'number', 'uploads'],
    ['allowed_file_types', 'jpg,png,gif,mp4,mp3,pdf', 'string', 'uploads']
  ];

  for (const [key, value, type, category] of defaultSettings) {
    await db.run(
      'INSERT OR IGNORE INTO settings (key, value, type, category) VALUES (?, ?, ?, ?)',
      [key, value, type, category]
    );
  }

  console.log('✅ Database initialized successfully');
  return db;
}

module.exports = { db, initDatabase, Database };
