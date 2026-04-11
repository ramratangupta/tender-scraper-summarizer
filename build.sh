# build.sh
#!/bin/bash

# Exit on any error
set -e
node --version
# Install Node.js dependencies
echo "Installing Node.js dependencies... Frontend"
echo "********************************************"
cd frontend
npm ci --include=dev

# Run frontend tests
echo "Running frontend tests..."
echo "*************************"
NODE_ENV=test npm test -- --run --coverage

npm run build

echo "Installing Node.js dependencies... Backend"
echo "********************************************"

cd ../api
npm ci

# Run backend tests (if any)
echo "Running backend tests..."
echo "************************"
# Backend currently has no tests - skip for now
echo "No backend tests configured - skipping"

# Copy public assets to dist
echo "Copying public assets..."
cd ..
cp -r frontend/public/* dist/ 2>/dev/null || true

# Return to root

# echo "Installing Node.js dependencies... Scraper"
# echo "********************************************"

# cd ../scraper
# npm ci
# echo "Running Scraper to save data"
# node index.js
cd ..
