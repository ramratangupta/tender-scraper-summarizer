# build.sh
#!/bin/bash

# Install Node.js dependencies
echo "Installing Node.js dependencies... Fronend"
echo "********************************************"
cd frontend
npm install
npm run build

echo "Installing Node.js dependencies... Backend"
echo "********************************************"

cd ../api
npm install
# Return to root

echo "Installing Node.js dependencies... Scraper"
echo "********************************************"

cd ../scraper
npm install
echo "Running Scraper to save data"
node index.js
cd ..
