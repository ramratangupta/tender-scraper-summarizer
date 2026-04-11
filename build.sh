# build.sh
#!/bin/bash

# Install Node.js dependencies
echo "Installing Node.js dependencies... Fronend"
echo "********************************************"
cd frontend
npm ci
npm run build

echo "Installing Node.js dependencies... Backend"
echo "********************************************"

cd ../api
npm ci
# Return to root

# echo "Installing Node.js dependencies... Scraper"
# echo "********************************************"

# cd ../scraper
# npm ci
# echo "Running Scraper to save data"
# node index.js
cd ..
