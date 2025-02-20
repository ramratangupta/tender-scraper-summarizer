const { execSync } = require('child_process');
const path = require('path');

// Ensure we're in the project root
process.chdir(path.join(__dirname));

// Install dependencies and build frontend
console.log('Building frontend...');
execSync('cd frontend && npm install && npm run build', { stdio: 'inherit' });
