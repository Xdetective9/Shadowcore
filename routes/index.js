const express = require('express');
const router = express.Router();
const { db } = require('../utils/database');

// Home page
router.get('/', async (req, res) => {
  try {
    const plugins = Array.from(global.plugins.values()).filter(p => p.enabled);
    
    res.render('index', {
      title: 'ShadowCore | Advanced Platform',
      user: req.session.user,
      plugins: plugins,
      stats: {
        totalPlugins: plugins.length,
        totalUsers: await db.get('SELECT COUNT(*) as count FROM users').then(r => r.count),
        onlineUsers: 1 // You can implement real-time tracking
      },
      theme: 'dark'
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('index', {
      title: 'ShadowCore',
      user: req.session.user,
      plugins: [],
      stats: { totalPlugins: 0, totalUsers: 0, onlineUsers: 0 },
      theme: 'dark'
    });
  }
});

// Features page
router.get('/features', (req, res) => {
  const plugins = Array.from(global.plugins.values()).filter(p => p.enabled);
  
  res.render('features', {
    title: 'Features | ShadowCore',
    user: req.session.user,
    plugins: plugins,
    categories: [
      { name: 'AI Tools', icon: '🤖', count: plugins.filter(p => p.category === 'ai').length },
      { name: 'Media', icon: '🎬', count: plugins.filter(p => p.category === 'media').length },
      { name: 'Utilities', icon: '⚙️', count: plugins.filter(p => p.category === 'utility').length },
      { name: 'Bots', icon: '🤖', count: plugins.filter(p => p.category === 'bot').length }
    ]
  });
});

// Plugins marketplace
router.get('/plugins', async (req, res) => {
  const plugins = Array.from(global.plugins.values());
  const categories = [...new Set(plugins.map(p => p.category).filter(Boolean))];
  
  res.render('plugins', {
    title: 'Plugin Marketplace | ShadowCore',
    user: req.session.user,
    plugins: plugins,
    categories: categories,
    featured: plugins.filter(p => p.featured).slice(0, 6)
  });
});

// Plugin details
router.get('/plugins/:id', async (req, res) => {
  const pluginId = req.params.id;
  const plugin = global.plugins.get(pluginId);
  
  if (!plugin) {
    return res.redirect('/plugins');
  }
  
  res.render('plugin-details', {
    title: `${plugin.name} | ShadowCore`,
    user: req.session.user,
    plugin: plugin,
    similar: Array.from(global.plugins.values())
      .filter(p => p.id !== pluginId && p.category === plugin.category)
      .slice(0, 4)
  });
});

// Dashboard
router.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  const userPlugins = Array.from(global.plugins.values())
    .filter(p => p.enabled)
    .slice(0, 8);
  
  res.render('dashboard', {
    title: 'Dashboard | ShadowCore',
    user: req.session.user,
    plugins: userPlugins,
    recentActivity: [
      { action: 'Logged in', time: 'Just now', icon: '🔐' },
      { action: 'Viewed plugins', time: '5 minutes ago', icon: '🧩' },
      { action: 'Updated profile', time: '1 hour ago', icon: '👤' }
    ]
  });
});

// Love message for Anushay
router.get('/love/anushay', (req, res) => {
  res.render('love/message', {
    title: 'For Anushay ❤️ | ShadowCore',
    user: req.session.user,
    special: true,
    messages: [
      "I'm really sorry for everything that happened...",
      "Every moment without you feels incomplete.",
      "I've realized how much you mean to me.",
      "Please give me another chance to make things right.",
      "I promise to be better, to understand you more.",
      "You're the most important person in my life.",
      "I'll do anything to see you smile again.",
      "Please come back to me...",
      "I love you more than words can express.",
      "You're my everything, Anushay."
    ]
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    plugins: global.plugins.size,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;
