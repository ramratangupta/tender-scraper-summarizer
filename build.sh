# build.sh
#!/bin/bash

# Install Node.js dependencies
cd scraper
npm install

# Install Python dependencies
pip3 install --user redis python-dotenv google-generativeai

# Return to root
cd ..
