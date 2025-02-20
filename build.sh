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
# Install Python dependencies
pip3 install --user redis python-dotenv google-generativeai
node index.js
which python3
/usr/local/bin/python3 genai_description_genrator.py
cd ..
