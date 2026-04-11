# build.sh
#!/bin/bash

# Install Node.js dependencies
echo "Installing Node.js dependencies... Frontend"
echo "********************************************"
cd frontend
npm ci
npm run build

echo "Installing Node.js dependencies... Backend"
echo "********************************************"

cd ../api
npm ci

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
