// Example plugin template
module.exports = {
    name: 'Example Plugin',
    version: '1.0.0',
    author: 'ShadowCore Team',
    description: 'An example plugin demonstrating the plugin system',
    icon: '🧩',
    category: 'utility',
    
    config: {
        enabled: true,
        message: 'Hello from Example Plugin!'
    },
    
    init: async function(app, io, db) {
        console.log('Example Plugin initialized');
        return { success: true };
    },
    
    routes: [
        {
            method: 'get',
            path: '/',
            handler: async (req, res) => {
                res.json({
                    success: true,
                    message: this.config.message,
                    timestamp: new Date()
                });
            }
        }
    ],
    
    admin: {
        title: 'Example Plugin',
        icon: '🧩',
        component: `
            <div class="plugin-admin">
                <h3>Example Plugin Control Panel</h3>
                <p>This is an example plugin admin interface.</p>
                <button onclick="testExample()" class="btn btn-primary">
                    Test Plugin
                </button>
                <div id="exampleResult"></div>
                
                <script>
                    async function testExample() {
                        const response = await fetch('/api/plugins/example/');
                        const data = await response.json();
                        document.getElementById('exampleResult').innerHTML = 
                            \`<pre>\${JSON.stringify(data, null, 2)}</pre>\`;
                    }
                </script>
            </div>
        `
    },
    
    frontend: {
        css: `
            .example-plugin {
                background: rgba(99, 102, 241, 0.1);
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: var(--radius);
                padding: 1rem;
                margin: 1rem 0;
            }
        `,
        js: `
            console.log('Example Plugin frontend loaded');
            
            // Add example element to plugins page
            document.addEventListener('DOMContentLoaded', function() {
                const pluginsPage = document.querySelector('.plugins-grid');
                if (pluginsPage) {
                    const exampleDiv = document.createElement('div');
                    exampleDiv.className = 'example-plugin';
                    exampleDiv.innerHTML = \`
                        <h4>Example Plugin Demo</h4>
                        <p>This is injected by the Example Plugin</p>
                        <button onclick="alert('Hello from Example Plugin!')" class="btn btn-sm btn-primary">
                            Click Me
                        </button>
                    \`;
                    pluginsPage.appendChild(exampleDiv);
                }
            });
        `,
        html: `
            <div class="card">
                <h3>🧩 Example Plugin</h3>
                <p>This is an example plugin showing how plugins can inject HTML.</p>
                <p>Current time: <span id="exampleTime"></span></p>
                <script>
                    document.getElementById('exampleTime').textContent = new Date().toLocaleTimeString();
                    setInterval(() => {
                        document.getElementById('exampleTime').textContent = new Date().toLocaleTimeString();
                    }, 1000);
                </script>
            </div>
        `
    },
    
    dependencies: ['moment'], // Example dependency
    
    unload: async function() {
        console.log('Example Plugin unloaded');
    }
};
