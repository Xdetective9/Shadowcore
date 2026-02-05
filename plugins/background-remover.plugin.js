// ShadowCore Background Remover Plugin
// Uses: https://www.remove.bg API

module.exports = {
  // ========== PLUGIN METADATA ==========
  id: 'background-remover',
  name: 'Background Remover',
  version: '1.0.0',
  author: 'ShadowCore Team',
  description: 'Remove backgrounds from images using AI',
  icon: '🎨',
  category: 'media',
  featured: true,
  
  // ========== CONFIGURATION ==========
  config: {
    apiKey: process.env.BACKGROUND_REMOVER_API || 'xv5aoeuirxTNZBYS5KykZZEK',
    apiUrl: 'https://api.remove.bg/v1.0/removebg',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    outputFormat: 'png'
  },
  
  // ========== INITIALIZATION ==========
  init: async function(app, io, db) {
    console.log('🎨 Background Remover plugin initialized');
    
    // Create upload directory for this plugin
    const fs = require('fs').promises;
    const path = require('path');
    const uploadDir = path.join(__dirname, '../public/uploads/background-remover');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory already exists
    }
    
    return { 
      success: true, 
      message: 'Background Remover ready',
      endpoints: [
        '/api/plugins/background-remover/upload',
        '/api/plugins/background-remover/process',
        '/api/plugins/background-remover/history'
      ]
    };
  },
  
  // ========== ROUTES ==========
  routes: [
    {
      method: 'get',
      path: '/',
      handler: async (req, res) => {
        res.json({
          success: true,
          plugin: 'Background Remover',
          version: this.version,
          status: 'active',
          config: {
            maxFileSize: this.config.maxFileSize,
            allowedFormats: this.config.allowedFormats
          }
        });
      }
    },
    
    {
      method: 'post',
      path: '/upload',
      handler: async (req, res) => {
        try {
          if (!req.files || !req.files.image) {
            return res.status(400).json({
              success: false,
              error: 'No image file uploaded'
            });
          }
          
          const image = req.files.image;
          const fileExt = image.name.split('.').pop().toLowerCase();
          
          // Validate file type
          if (!this.config.allowedFormats.includes(fileExt)) {
            return res.status(400).json({
              success: false,
              error: `Invalid file format. Allowed: ${this.config.allowedFormats.join(', ')}`
            });
          }
          
          // Validate file size
          if (image.size > this.config.maxFileSize) {
            return res.status(400).json({
              success: false,
              error: `File too large. Max: ${this.config.maxFileSize / (1024 * 1024)}MB`
            });
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const filename = `original_${timestamp}.${fileExt}`;
          const filepath = path.join(__dirname, '../public/uploads/background-remover', filename);
          
          // Save file
          await image.mv(filepath);
          
          res.json({
            success: true,
            message: 'Image uploaded successfully',
            filename: filename,
            originalName: image.name,
            size: image.size,
            timestamp: timestamp
          });
          
        } catch (error) {
          console.error('Upload error:', error);
          res.status(500).json({
            success: false,
            error: 'Upload failed: ' + error.message
          });
        }
      }
    },
    
    {
      method: 'post',
      path: '/process',
      handler: async (req, res) => {
        try {
          const { filename } = req.body;
          
          if (!filename) {
            return res.status(400).json({
              success: false,
              error: 'Filename is required'
            });
          }
          
          const filepath = path.join(__dirname, '../public/uploads/background-remover', filename);
          const fs = require('fs');
          
          // Check if file exists
          if (!fs.existsSync(filepath)) {
            return res.status(404).json({
              success: false,
              error: 'File not found'
            });
          }
          
          // Read file as base64
          const imageBuffer = fs.readFileSync(filepath);
          const base64Image = imageBuffer.toString('base64');
          
          // Call Remove.bg API
          const axios = require('axios');
          const FormData = require('form-data');
          
          const formData = new FormData();
          formData.append('image_file', imageBuffer, filename);
          formData.append('size', 'auto');
          
          const response = await axios.post(this.config.apiUrl, formData, {
            headers: {
              ...formData.getHeaders(),
              'X-Api-Key': this.config.apiKey
            },
            responseType: 'arraybuffer'
          });
          
          // Save processed image
          const outputFilename = `processed_${Date.now()}.png`;
          const outputPath = path.join(__dirname, '../public/uploads/background-remover', outputFilename);
          
          fs.writeFileSync(outputPath, response.data);
          
          // Create download URL
          const downloadUrl = `/static/uploads/background-remover/${outputFilename}`;
          
          res.json({
            success: true,
            message: 'Background removed successfully',
            original: filename,
            processed: outputFilename,
            downloadUrl: downloadUrl,
            size: response.data.length,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('Processing error:', error);
          
          let errorMessage = 'Processing failed';
          if (error.response) {
            errorMessage = `API Error: ${error.response.status} - ${error.response.data}`;
          }
          
          res.status(500).json({
            success: false,
            error: errorMessage
          });
        }
      }
    },
    
    {
      method: 'get',
      path: '/history',
      handler: async (req, res) => {
        try {
          const fs = require('fs').promises;
          const path = require('path');
          const dir = path.join(__dirname, '../public/uploads/background-remover');
          
          const files = await fs.readdir(dir);
          const images = files
            .filter(f => f.startsWith('processed_'))
            .map(f => ({
              filename: f,
              url: `/static/uploads/background-remover/${f}`,
              created: fs.statSync(path.join(dir, f)).mtime
            }))
            .sort((a, b) => b.created - a.created)
            .slice(0, 20);
          
          res.json({
            success: true,
            images: images,
            count: images.length
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    }
  ],
  
  // ========== ADMIN PANEL ==========
  admin: {
    title: 'Background Remover',
    icon: '🎨',
    component: `
      <div class="plugin-admin-card">
        <div class="plugin-header">
          <h3>🎨 Background Remover</h3>
          <span class="plugin-badge">Active</span>
        </div>
        
        <div class="plugin-stats">
          <div class="stat">
            <span class="stat-label">API Status</span>
            <span class="stat-value" id="apiStatus">Checking...</span>
          </div>
          <div class="stat">
            <span class="stat-label">Processed Today</span>
            <span class="stat-value" id="processedCount">0</span>
          </div>
          <div class="stat">
            <span class="stat-label">Storage Used</span>
            <span class="stat-value" id="storageUsed">0 MB</span>
          </div>
        </div>
        
        <div class="plugin-actions">
          <button onclick="testBackgroundRemover()" class="btn btn-primary">
            Test API
          </button>
          <button onclick="clearHistory()" class="btn btn-secondary">
            Clear History
          </button>
          <button onclick="openSettings()" class="btn btn-outline">
            Settings
          </button>
        </div>
        
        <div id="pluginResponse" class="plugin-response"></div>
      </div>
      
      <script>
        async function testBackgroundRemover() {
          const responseDiv = document.getElementById('pluginResponse');
          responseDiv.innerHTML = '<div class="loading">Testing API...</div>';
          
          try {
            const response = await fetch('/api/plugins/background-remover/');
            const data = await response.json();
            
            if (data.success) {
              responseDiv.innerHTML = \`
                <div class="success">
                  ✅ API working: \${data.plugin} v\${data.version}
                  <br>
                  Max file size: \${data.config.maxFileSize / (1024 * 1024)}MB
                </div>
              \`;
              
              document.getElementById('apiStatus').textContent = 'Connected';
              document.getElementById('apiStatus').style.color = '#10b981';
            }
          } catch (error) {
            responseDiv.innerHTML = \`
              <div class="error">
                ❌ API test failed: \${error.message}
              </div>
            \`;
          }
        }
        
        function clearHistory() {
          if (confirm('Clear all processed images?')) {
            fetch('/api/plugins/background-remover/history/clear', {
              method: 'DELETE'
            }).then(response => response.json())
              .then(data => {
                alert(data.message || 'History cleared');
              });
          }
        }
        
        function openSettings() {
          window.open('/plugins/background-remover/settings', '_blank');
        }
      </script>
    `
  },
  
  // ========== FRONTEND COMPONENT ==========
  frontend: {
    css: `
      .bg-remover-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 20px;
        padding: 2rem;
        color: white;
        margin: 2rem 0;
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        animation: fadeIn 0.6s ease-out;
      }
      
      .bg-remover-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      
      .bg-remover-icon {
        font-size: 3rem;
        animation: float 3s ease-in-out infinite;
      }
      
      .upload-area {
        border: 3px dashed rgba(255,255,255,0.3);
        border-radius: 15px;
        padding: 3rem 2rem;
        text-align: center;
        margin: 2rem 0;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .upload-area:hover {
        border-color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.05);
      }
      
      .upload-area.dragover {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }
      
      .preview-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin: 2rem 0;
      }
      
      .image-preview {
        background: rgba(0,0,0,0.2);
        border-radius: 10px;
        overflow: hidden;
        min-height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .image-preview img {
        max-width: 100%;
        max-height: 300px;
        border-radius: 8px;
      }
      
      .processing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        border-radius: 10px;
      }
      
      .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255,255,255,0.3);
        border-top: 5px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `,
    
    js: `
      class BackgroundRemover {
        constructor() {
          this.currentFile = null;
          this.processing = false;
          this.initialize();
        }
        
        initialize() {
          this.setupDragAndDrop();
          this.setupEventListeners();
          this.loadHistory();
        }
        
        setupDragAndDrop() {
          const uploadArea = document.getElementById('uploadArea');
          
          ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
              e.preventDefault();
              e.stopPropagation();
            });
          });
          
          ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
              uploadArea.classList.add('dragover');
            });
          });
          
          ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
              uploadArea.classList.remove('dragover');
            });
          });
          
          uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              this.handleFile(files[0]);
            }
          });
          
          uploadArea.addEventListener('click', () => {
            document.getElementById('fileInput').click();
          });
        }
        
        setupEventListeners() {
          document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
              this.handleFile(e.target.files[0]);
            }
          });
          
          document.getElementById('removeBgBtn').addEventListener('click', () => {
            this.processImage();
          });
          
          document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadResult();
          });
        }
        
        async handleFile(file) {
          // Validate file
          const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
          if (!validTypes.includes(file.type)) {
            this.showError('Please upload a JPEG, PNG, or WebP image');
            return;
          }
          
          if (file.size > 10 * 1024 * 1024) {
            this.showError('File size must be less than 10MB');
            return;
          }
          
          this.currentFile = file;
          
          // Show preview
          const reader = new FileReader();
          reader.onload = (e) => {
            document.getElementById('originalPreview').innerHTML = \`
              <img src="\${e.target.result}" alt="Original">
            \`;
            document.getElementById('removeBgBtn').disabled = false;
          };
          reader.readAsDataURL(file);
          
          this.showMessage('✓ Image ready for processing');
        }
        
        async processImage() {
          if (!this.currentFile || this.processing) return;
          
          this.processing = true;
          this.showProcessing(true);
          
          try {
            // Upload file
            const formData = new FormData();
            formData.append('image', this.currentFile);
            
            const uploadResponse = await fetch('/api/plugins/background-remover/upload', {
              method: 'POST',
              body: formData
            });
            
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
              throw new Error(uploadData.error);
            }
            
            // Process image
            const processResponse = await fetch('/api/plugins/background-remover/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: uploadData.filename })
            });
            
            const processData = await processResponse.json();
            
            if (!processData.success) {
              throw new Error(processData.error);
            }
            
            // Show result
            document.getElementById('processedPreview').innerHTML = \`
              <img src="\${processData.downloadUrl}" alt="Background Removed">
            \`;
            
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('downloadBtn').dataset.url = processData.downloadUrl;
            
            this.showMessage('✅ Background removed successfully!');
            this.loadHistory();
            
          } catch (error) {
            this.showError('Processing failed: ' + error.message);
          } finally {
            this.processing = false;
            this.showProcessing(false);
          }
        }
        
        downloadResult() {
          const url = document.getElementById('downloadBtn').dataset.url;
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'background-removed.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
        
        async loadHistory() {
          try {
            const response = await fetch('/api/plugins/background-remover/history');
            const data = await response.json();
            
            if (data.success && data.images.length > 0) {
              const historyHTML = data.images.slice(0, 5).map(img => \`
                <div class="history-item">
                  <img src="\${img.url}" alt="Processed">
                  <span class="history-date">\${new Date(img.created).toLocaleDateString()}</span>
                </div>
              \`).join('');
              
              document.getElementById('historyContainer').innerHTML = historyHTML;
            }
          } catch (error) {
            console.log('Could not load history:', error);
          }
        }
        
        showProcessing(show) {
          const overlay = document.getElementById('processingOverlay');
          overlay.style.display = show ? 'flex' : 'none';
        }
        
        showMessage(message) {
          const messageDiv = document.getElementById('message');
          messageDiv.textContent = message;
          messageDiv.className = 'message success';
          messageDiv.style.display = 'block';
          
          setTimeout(() => {
            messageDiv.style.display = 'none';
          }, 3000);
        }
        
        showError(message) {
          const messageDiv = document.getElementById('message');
          messageDiv.textContent = message;
          messageDiv.className = 'message error';
          messageDiv.style.display = 'block';
          
          setTimeout(() => {
            messageDiv.style.display = 'none';
          }, 5000);
        }
      }
      
      // Initialize when DOM is loaded
      document.addEventListener('DOMContentLoaded', () => {
        window.bgRemover = new BackgroundRemover();
      });
    `,
    
    html: `
      <div class="bg-remover-card">
        <div class="bg-remover-header">
          <div class="bg-remover-icon">🎨</div>
          <div>
            <h2>Background Remover</h2>
            <p>Remove backgrounds from images instantly</p>
          </div>
        </div>
        
        <div id="message" class="message" style="display: none;"></div>
        
        <div class="upload-area" id="uploadArea">
          <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp" style="display: none;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">📁</div>
          <h3>Drag & Drop Image Here</h3>
          <p>or click to browse (JPEG, PNG, WebP)</p>
          <p style="opacity: 0.7; margin-top: 0.5rem;">Max size: 10MB</p>
        </div>
        
        <div class="preview-container">
          <div class="image-preview" id="originalPreview">
            <div style="text-align: center; color: rgba(255,255,255,0.5);">
              <div style="font-size: 3rem;">🖼️</div>
              <p>Original Image</p>
            </div>
          </div>
          
          <div class="image-preview" id="processedPreview">
            <div style="text-align: center; color: rgba(255,255,255,0.5);">
              <div style="font-size: 3rem;">✨</div>
              <p>Background Removed</p>
            </div>
            
            <div class="processing-overlay" id="processingOverlay" style="display: none;">
              <div class="spinner"></div>
              <p>Removing background...</p>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin: 2rem 0;">
          <button id="removeBgBtn" class="btn btn-light" style="flex: 1;" disabled>
            🎨 Remove Background
          </button>
          <button id="downloadBtn" class="btn btn-outline-light" style="flex: 1;" disabled>
            ⬇️ Download Result
          </button>
        </div>
        
        <div style="margin-top: 3rem;">
          <h4>📚 Recent Processed Images</h4>
          <div id="historyContainer" style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
          ">
            <div style="text-align: center; color: rgba(255,255,255,0.5);">
              No history yet
            </div>
          </div>
        </div>
      </div>
    `
  },
  
  // ========== UNINSTALL ==========
  unload: async function() {
    console.log('🗑️ Background Remover plugin unloaded');
    // Cleanup if needed
  }
};
