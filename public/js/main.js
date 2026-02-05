// ShadowCore Main JavaScript

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initNotifications();
    initAnimations();
    initTooltips();
    initForms();
    
    // Check for messages in URL
    checkUrlMessages();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const themeToggle = document.getElementById('themeToggle');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        if (themeToggle) themeToggle.checked = false;
    }
    
    // Theme toggle event
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
            }
            
            // Save to server if logged in
            if (typeof user !== 'undefined' && user.id) {
                fetch('/api/settings/theme', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ theme: this.checked ? 'light' : 'dark' })
                });
            }
        });
    }
}

// Notification System
function initNotifications() {
    window.showNotification = function(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notificationContainer') || createNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">${getNotificationIcon(type)}</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="margin-left: auto; background: none; border: none; color: var(--gray); cursor: pointer; font-size: 1.25rem;">
                    ×
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.opacity = '1', 10);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        return notification;
    };
    
    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }
    
    function getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
}

// Animations
function initAnimations() {
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, { threshold: 0.1 });
    
    // Observe elements with data-animate attribute
    document.querySelectorAll('[data-animate]').forEach(el => {
        observer.observe(el);
    });
    
    // Add parallax effect to hero
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            hero.style.transform = `translateY(${rate}px)`;
        });
    }
}

// Tooltips
function initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltipText = element.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
        });
        
        element.addEventListener('mouseleave', () => {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) tooltip.remove();
        });
    });
}

// Form handling
function initForms() {
    const forms = document.querySelectorAll('form[data-ajax]');
    
    forms.forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            // Show loading
            submitBtn.innerHTML = '<span class="loading" style="margin-right: 0.5rem;"></span> Processing...';
            submitBtn.disabled = true;
            
            try {
                const formData = new FormData(this);
                const response = await fetch(this.action, {
                    method: this.method,
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(result.message || 'Success!', 'success');
                    
                    // Redirect if specified
                    if (result.redirect) {
                        setTimeout(() => {
                            window.location.href = result.redirect;
                        }, 1500);
                    }
                    
                    // Reset form if specified
                    if (result.reset) {
                        this.reset();
                    }
                } else {
                    showNotification(result.error || 'An error occurred', 'error');
                }
            } catch (error) {
                showNotification('Network error. Please try again.', 'error');
            } finally {
                // Restore button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    });
}

// Check for messages in URL
function checkUrlMessages() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    
    if (success) {
        showNotification(decodeURIComponent(success), 'success');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (error) {
        showNotification(decodeURIComponent(error), 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy', 'error');
    });
}

// Plugin system helper
window.ShadowCore = {
    showNotification,
    copyToClipboard,
    debounce,
    
    // Plugin utilities
    loadPlugin: async function(pluginId) {
        try {
            showNotification('Loading plugin...', 'info');
            
            const response = await fetch(`/api/plugins/${pluginId}/load`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Plugin loaded successfully!', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotification(result.error, 'error');
            }
        } catch (error) {
            showNotification('Failed to load plugin', 'error');
        }
    },
    
    togglePlugin: async function(pluginId, enabled) {
        try {
            const response = await fetch(`/admin/plugins/${pluginId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(result.message, 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotification(result.error, 'error');
            }
        } catch (error) {
            showNotification('Failed to toggle plugin', 'error');
        }
    }
};
