# build.sh
#!/bin/bash

# Install Node.js dependencies
cd frontend
npm install
npm run build
cd ../scraper
npm install
# Install Python dependencies
pip3 install --user redis python-dotenv google-generativeai
cd ../api
npm install
# Return to root
cd ..
