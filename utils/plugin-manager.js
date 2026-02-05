const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class PluginManager {
  constructor(app) {
    this.app = app;
    this.pluginsDir = path.join(__dirname, '../plugins');
    this.loadedPlugins = new Map();
  }

  async loadAllPlugins() {
    try {
      await fs.access(this.pluginsDir);
    } catch {
      await fs.mkdir(this.pluginsDir, { recursive: true });
      console.log('📁 Created plugins directory');
      return;
    }

    const files = await fs.readdir(this.pluginsDir);
    
    for (const file of files) {
      if (file.endsWith('.plugin.js')) {
        await this.loadPlugin(file);
      } else if (file.endsWith('.zip')) {
        await this.installZipPlugin(file);
      }
    }
  }

  async loadPlugin(filename) {
    try {
      const pluginPath = path.join(this.pluginsDir, filename);
      const pluginCode = await fs.readFile(pluginPath, 'utf8');
      const pluginId = filename.replace('.plugin.js', '');

      // Create safe sandbox
      const sandbox = {
        console,
        require,
        module: { exports: {} },
        __filename: pluginPath,
        __dirname: path.dirname(pluginPath),
        process: {
          env: { ...process.env },
          cwd: () => process.cwd()
        },
        Buffer,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
      };

      vm.createContext(sandbox);
      vm.runInContext(pluginCode, sandbox);

      const plugin = sandbox.module.exports;
      
      if (!plugin || typeof plugin !== 'object') {
        throw new Error('Plugin must export an object');
      }

      // Validate plugin
      if (!plugin.name) plugin.name = pluginId;
      if (!plugin.version) plugin.version = '1.0.0';
      if (!plugin.id) plugin.id = pluginId;

      // Store plugin
      this.loadedPlugins.set(pluginId, {
        ...plugin,
        id: pluginId,
        filename,
        loadedAt: new Date(),
        enabled: true
      });

      // Initialize plugin
      if (typeof plugin.init === 'function') {
        try {
          const initResult = await plugin.init(this.app, global.io, require('./database').db);
          console.log(`✅ Plugin "${plugin.name}" initialized:`, initResult);
        } catch (initErr) {
          console.error(`❌ Plugin "${plugin.name}" init failed:`, initErr);
        }
      }

      // Register routes if provided
      if (Array.isArray(plugin.routes)) {
        plugin.routes.forEach(route => {
          if (route.path && route.handler) {
            const method = (route.method || 'get').toLowerCase();
            const fullPath = `/api/plugins/${pluginId}${route.path}`;
            
            this.app[method](fullPath, async (req, res) => {
              try {
                await route.handler(req, res, plugin);
              } catch (err) {
                console.error(`Plugin route error (${pluginId}):`, err);
                res.status(500).json({ error: 'Plugin route error' });
              }
            });
            
            console.log(`🛣️  Registered route: ${method.toUpperCase()} ${fullPath}`);
          }
        });
      }

      // Register middleware if provided
      if (typeof plugin.middleware === 'function') {
        this.app.use(async (req, res, next) => {
          try {
            await plugin.middleware(req, res, next, plugin);
          } catch (err) {
            next(err);
          }
        });
      }

      // Register socket events if provided
      if (typeof plugin.socket === 'function') {
        global.pluginSockets.push((socket, io) => {
          plugin.socket(socket, io, plugin);
        });
      }

      // Inject CSS/JS if provided
      if (plugin.css) {
        const cssPath = path.join(__dirname, '../public/plugins', `${pluginId}.css`);
        await fs.writeFile(cssPath, plugin.css);
      }

      if (plugin.js) {
        const jsPath = path.join(__dirname, '../public/plugins', `${pluginId}.js`);
        await fs.writeFile(jsPath, plugin.js);
      }

      // Handle dependencies
      if (Array.isArray(plugin.dependencies)) {
        await this.installDependencies(plugin.dependencies, pluginId);
      }

      console.log(`✅ Loaded plugin: ${plugin.name} v${plugin.version}`);
      return plugin;

    } catch (error) {
      console.error(`❌ Failed to load plugin ${filename}:`, error.message);
      return null;
    }
  }

  async installDependencies(deps, pluginId) {
    const missingDeps = [];
    
    for (const dep of deps) {
      try {
        require.resolve(dep);
      } catch {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      console.log(`📦 Installing dependencies for ${pluginId}:`, missingDeps);
      try {
        await execAsync(`npm install ${missingDeps.join(' ')}`);
        console.log(`✅ Dependencies installed for ${pluginId}`);
      } catch (err) {
        console.error(`❌ Failed to install dependencies for ${pluginId}:`, err);
      }
    }
  }

  async installZipPlugin(zipFilename) {
    // Implementation for zip file extraction and installation
    console.log(`📦 Installing zip plugin: ${zipFilename}`);
    // Add zip extraction logic here
  }

  async unloadPlugin(pluginId) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin) {
      if (typeof plugin.unload === 'function') {
        await plugin.unload();
      }
      this.loadedPlugins.delete(pluginId);
      console.log(`🗑️  Unloaded plugin: ${pluginId}`);
    }
  }

  async reloadPlugin(pluginId) {
    await this.unloadPlugin(pluginId);
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin) {
      await this.loadPlugin(plugin.filename);
    }
  }

  getPlugin(pluginId) {
    return this.loadedPlugins.get(pluginId);
  }

  getAllPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  async saveToDatabase() {
    const { db } = require('./database');
    
    for (const [id, plugin] of this.loadedPlugins) {
      await db.run(
        `INSERT OR REPLACE INTO plugins (id, name, version, author, description, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, plugin.name, plugin.version, plugin.author, plugin.description, 
         plugin.enabled ? 1 : 0, JSON.stringify(plugin.config || {})]
      );
    }
  }
}

module.exports = PluginManager;
