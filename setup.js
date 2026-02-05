const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function setupProject() {
  console.log('🚀 Setting up ShadowCore...');
  
  // Create necessary directories
  const dirs = [
    'public/uploads',
    'public/assets/images',
    'public/assets/fonts',
    'public/assets/sounds',
    'plugins',
    'logs',
    'temp',
    'database',
    'views/admin',
    'views/errors',
    'views/love',
    'routes',
    'middleware',
    'utils',
    'config'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(path.join(__dirname, dir), { recursive: true });
      console.log(`✅ Created: ${dir}`);
    } catch (err) {
      console.log(`⚠️  ${dir}: ${err.code === 'EEXIST' ? 'Exists' : err.message}`);
    }
  }
  
  // Create default .env if not exists
  const envPath = path.join(__dirname, '.env');
  try {
    await fs.access(envPath);
    console.log('✅ .env file exists');
  } catch {
    const envContent = `# ShadowCore Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=shadowcore-secret-${Date.now()}-${Math.random().toString(36).substr(2)}
OWNER_NAME=Abdullah
OWNER_EMAIL=
ADMIN_PASSWORD=ShadowCore@2024
UPLOAD_PATH=./public/uploads
MAX_FILE_SIZE=52428800
LOG_LEVEL=info

# Plugin APIs (Add as needed)
BACKGROUND_REMOVER_API=xv5aoeuirxTNZBYS5KykZZEK
`;
    
    await fs.writeFile(envPath, envContent);
    console.log('✅ Created .env file');
  }
  
  // Install dependencies if package.json exists
  try {
    await fs.access(path.join(__dirname, 'package.json'));
    console.log('📦 Installing dependencies...');
    const { stdout, stderr } = await execAsync('npm install');
    if (stderr) console.log('⚠️  npm warnings:', stderr);
    console.log('✅ Dependencies installed');
  } catch (err) {
    console.log('⚠️  package.json not found, skipping npm install');
  }
  
  console.log('\n🎉 ShadowCore setup complete!');
  console.log('Next steps:');
  console.log('1. Edit .env file with your configuration');
  console.log('2. Run: npm start');
  console.log('3. Visit: http://localhost:3000');
  console.log('4. Admin login: /admin/login');
  console.log('   Password: ShadowCore@2024 (change in .env)');
}

setupProject().catch(console.error);
