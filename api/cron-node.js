// api/cron-node.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file's directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  try {
    // Get absolute path to scraper directory
    const scraperPath = path.join(process.cwd(), 'scraper');
    
    console.log('Starting cron job execution...');

    // Step 1: Install Node.js dependencies
    console.log('Installing Node.js dependencies...');
    await new Promise((resolve, reject) => {
      exec('npm install', {
        cwd: scraperPath
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to install Node.js dependencies:', error);
          reject(error);
        } else {
          console.log('Node.js dependencies installed successfully');
          resolve(stdout);
        }
      });
    });

    // Step 2: Run scraper/index.js first
    console.log('Running scraper/index.js...');
    await new Promise((resolve, reject) => {
      exec('node index.js', {
        cwd: scraperPath
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Node Scraper Error:', error);
          reject(error);
        } else {
          console.log('Node Scraper Output:', stdout);
          resolve(stdout);
        }
      });
    });

    // Step 3: Install Python dependencies
    console.log('Installing Python dependencies...');
    await new Promise((resolve, reject) => {
      exec('pip3 install redis python-dotenv google-generativeai', {
        cwd: scraperPath
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to install Python dependencies:', error);
          reject(error);
        } else {
          console.log('Python dependencies installed successfully');
          resolve(stdout);
        }
      });
    });

    // Step 4: Run Python script
    console.log('Running genai_description_genrator.py...');
    await new Promise((resolve, reject) => {
      exec('python3 genai_description_genrator.py', {
        cwd: scraperPath
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Python Script Error:', error);
          reject(error);
        } else {
          console.log('Python Script Output:', stdout);
          resolve(stdout);
        }
      });
    });

    console.log('All tasks completed successfully');

    res.status(200).json({ 
      success: true,
      message: 'Sequential execution completed successfully: index.js → genai_description_genrator.py',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron execution failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
