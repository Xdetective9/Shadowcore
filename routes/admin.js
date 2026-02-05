const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { db } = require('../utils/database');
const bcrypt = require('bcryptjs');

// Middleware to check admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.redirect('/admin/login');
};

// Admin login page
router.get('/admin/login', (req, res) => {
  if (req.session.user?.role === 'admin') {
    return res.redirect('/admin');
  }
  
  res.render('admin/login', {
    title: 'Admin Login | ShadowCore',
    error: null
  });
});

// Admin login handler
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Check admin credentials
    const admin = await db.get(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, 'admin']
    );
    
    if (!admin) {
      return res.render('admin/login', {
        title: 'Admin Login | ShadowCore',
        error: 'Invalid credentials'
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password);
    
    if (!validPassword) {
      return res.render('admin/login', {
        title: 'Admin Login | ShadowCore',
        error: 'Invalid credentials'
      });
    }
    
    // Create admin session
    req.session.user = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: 'admin',
      avatar: admin.avatar,
      createdAt: admin.created_at
    };
    
    res.redirect('/admin');
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.render('admin/login', {
      title: 'Admin Login | ShadowCore',
      error: 'An error occurred'
    });
  }
});

// Admin dashboard
router.get('/admin', isAdmin, async (req, res) => {
  try {
    const [users, plugins, stats] = await Promise.all([
      db.all('SELECT * FROM users ORDER BY created_at DESC LIMIT 10'),
      db.all('SELECT * FROM plugins ORDER BY installed_at DESC LIMIT 10'),
      db.get('SELECT COUNT(*) as totalUsers FROM users')
    ]);
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard | ShadowCore',
      user: req.session.user,
      users: users,
      plugins: plugins,
      stats: {
        totalUsers: stats.totalUsers,
        totalPlugins: global.plugins.size,
        activePlugins: Array.from(global.plugins.values()).filter(p => p.enabled).length,
        storageUsed: await getStorageSize()
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.redirect('/admin/login');
  }
});

// Plugin management
router.get('/admin/plugins', isAdmin, async (req, res) => {
  const plugins = Array.from(global.plugins.values());
  
  res.render('admin/plugins', {
    title: 'Plugin Manager | ShadowCore',
    user: req.session.user,
    plugins: plugins,
    categories: [...new Set(plugins.map(p => p.category).filter(Boolean))]
  });
});

// Plugin upload page
router.get('/admin/plugins/upload', isAdmin, (req, res) => {
  res.render('admin/upload', {
    title: 'Upload Plugin | ShadowCore',
    user: req.session.user,
    error: null,
    success: null
  });
});

// Plugin upload handler
router.post('/admin/plugins/upload', isAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.plugin) {
      return res.render('admin/upload', {
        title: 'Upload Plugin | ShadowCore',
        user: req.session.user,
        error: 'No plugin file uploaded',
        success: null
      });
    }
    
    const pluginFile = req.files.plugin;
    const pluginDir = path.join(__dirname, '../plugins');
    
    // Validate file
    if (!pluginFile.name.endsWith('.plugin.js')) {
      return res.render('admin/upload', {
        title: 'Upload Plugin | ShadowCore',
        user: req.session.user,
        error: 'File must be a .plugin.js file',
        success: null
      });
    }
    
    // Save file
    const filePath = path.join(pluginDir, pluginFile.name);
    await pluginFile.mv(filePath);
    
    // Load plugin
    const PluginManager = require('../utils/plugin-manager');
    const pluginManager = new PluginManager(req.app);
    const plugin = await pluginManager.loadPlugin(pluginFile.name);
    
    if (!plugin) {
      await fs.unlink(filePath).catch(() => {});
      return res.render('admin/upload', {
        title: 'Upload Plugin | ShadowCore',
        user: req.session.user,
        error: 'Failed to load plugin. Invalid format.',
        success: null
      });
    }
    
    // Save to database
    await db.run(
      `INSERT OR REPLACE INTO plugins (name, version, author, description, enabled, config)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        plugin.name || pluginFile.name.replace('.plugin.js', ''),
        plugin.version || '1.0.0',
        plugin.author || 'Unknown',
        plugin.description || '',
        1,
        JSON.stringify(plugin.config || {})
      ]
    );
    
    res.render('admin/upload', {
      title: 'Upload Plugin | ShadowCore',
      user: req.session.user,
      error: null,
      success: `Plugin "${plugin.name}" uploaded and loaded successfully!`
    });
    
  } catch (error) {
    console.error('Plugin upload error:', error);
    res.render('admin/upload', {
      title: 'Upload Plugin | ShadowCore',
      user: req.session.user,
      error: `Upload failed: ${error.message}`,
      success: null
    });
  }
});

// Plugin toggle
router.post('/admin/plugins/:id/toggle', isAdmin, async (req, res) => {
  try {
    const pluginId = req.params.id;
    const plugin = global.plugins.get(pluginId);
    
    if (plugin) {
      plugin.enabled = !plugin.enabled;
      
      // Update in database
      await db.run(
        'UPDATE plugins SET enabled = ? WHERE name = ?',
        [plugin.enabled ? 1 : 0, plugin.name]
      );
      
      res.json({ success: true, enabled: plugin.enabled });
    } else {
      res.status(404).json({ success: false, error: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Plugin delete
router.delete('/admin/plugins/:id', isAdmin, async (req, res) => {
  try {
    const pluginId = req.params.id;
    const plugin = global.plugins.get(pluginId);
    
    if (plugin) {
      // Remove file
      const filePath = path.join(__dirname, '../plugins', `${pluginId}.plugin.js`);
      await fs.unlink(filePath).catch(() => {});
      
      // Remove from memory
      global.plugins.delete(pluginId);
      
      // Remove from database
      await db.run('DELETE FROM plugins WHERE name = ?', [plugin.name]);
      
      res.json({ success: true, message: 'Plugin deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Plugin not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User management
router.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
    
    res.render('admin/users', {
      title: 'User Management | ShadowCore',
      user: req.session.user,
      users: users
    });
  } catch (error) {
    console.error('User management error:', error);
    res.redirect('/admin');
  }
});

// Settings
router.get('/admin/settings', isAdmin, async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM settings ORDER BY category, key');
    
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});
    
    res.render('admin/settings', {
      title: 'Settings | ShadowCore',
      user: req.session.user,
      settings: groupedSettings,
      env: process.env
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.redirect('/admin');
  }
});

// Update settings
router.post('/admin/settings', isAdmin, async (req, res) => {
  try {
    const { key, value, type } = req.body;
    
    await db.run(
      'UPDATE settings SET value = ? WHERE key = ?',
      [value, key]
    );
    
    res.json({ success: true, message: 'Setting updated' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Install dependency
router.post('/admin/dependencies/install', isAdmin, async (req, res) => {
  try {
    const { dependency } = req.body;
    
    if (!dependency) {
      return res.json({ success: false, error: 'Dependency name required' });
    }
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const { stdout, stderr } = await execAsync(`npm install ${dependency}`);
    
    if (stderr && !stderr.includes('npm WARN')) {
      return res.json({ success: false, error: stderr });
    }
    
    res.json({ 
      success: true, 
      message: `Dependency "${dependency}" installed successfully` 
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Helper function to get storage size
async function getStorageSize() {
  const uploadsDir = path.join(__dirname, '../public/uploads');
  
  try {
    const files = await fs.readdir(uploadsDir);
    let totalSize = 0;
    
    for (const file of files) {
      const stats = await fs.stat(path.join(uploadsDir, file));
      totalSize += stats.size;
    }
    
    return (totalSize / (1024 * 1024)).toFixed(2) + ' MB';
  } catch {
    return '0 MB';
  }
}

module.exports = router;
