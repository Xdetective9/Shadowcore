const express = require('express');
const router = express.Router();

// API Health
router.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        plugins: global.plugins.size
    });
});

// Plugin API endpoints
router.get('/api/plugins', (req, res) => {
    const plugins = Array.from(global.plugins.values()).map(p => ({
        id: p.id,
        name: p.name,
        version: p.version,
        description: p.description,
        enabled: p.enabled
    }));
    
    res.json({
        success: true,
        plugins,
        count: plugins.length
    });
});

// Background Remover API
router.post('/api/background-remover/remove', async (req, res) => {
    try {
        // This would handle the background removal
        res.json({
            success: true,
            message: 'Background removed successfully',
            downloadUrl: '/static/uploads/processed.png'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// User settings
router.post('/api/settings/theme', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { theme } = req.body;
    // Save theme preference to database
    res.json({ success: true, theme });
});

module.exports = router;
