// Admin-specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Admin-only functionality
    if (typeof user !== 'undefined' && user.role === 'admin') {
        initAdminFeatures();
    }
});

function initAdminFeatures() {
    // Bulk actions
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) {
        bulkActions.addEventListener('change', function() {
            const action = this.value;
            if (action) {
                if (confirm(`Perform "${action}" on selected items?`)) {
                    // Implement bulk action
                }
                this.value = '';
            }
        });
    }
    
    // Quick stats update
    if (window.location.pathname.includes('/admin')) {
        setInterval(updateAdminStats, 30000);
    }
}

async function updateAdminStats() {
    try {
        const response = await fetch('/admin/api/stats');
        const data = await response.json();
        
        if (data.success) {
            // Update stats on page
            document.querySelectorAll('.stat-value').forEach(stat => {
                const statName = stat.dataset.stat;
                if (data[statName] !== undefined) {
                    stat.textContent = data[statName];
                }
            });
        }
    } catch (error) {
        console.log('Failed to update stats:', error);
    }
}

// Admin utility functions
window.Admin = {
    async deleteItem(type, id, name) {
        if (!confirm(`Delete ${type} "${name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/${type}/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                ShadowCore.showNotification(`${type} deleted successfully`, 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                ShadowCore.showNotification(data.error, 'error');
            }
        } catch (error) {
            ShadowCore.showNotification('Network error', 'error');
        }
    },
    
    async installDependency(dependency) {
        try {
            const response = await fetch('/admin/dependencies/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dependency })
            });
            
            const data = await response.json();
            
            if (data.success) {
                ShadowCore.showNotification(data.message, 'success');
            } else {
                ShadowCore.showNotification(data.error, 'error');
            }
        } catch (error) {
            ShadowCore.showNotification('Network error', 'error');
        }
    }
};
