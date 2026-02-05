module.exports = function(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        return res.redirect('/admin/login');
    }
    next();
};
