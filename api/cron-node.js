// api/cron-node.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  try {
    // Use /tmp directory for temporary operations
    const scraperPath = '/tmp/scraper';
    
    console.log('Starting cron job execution...');

    // Create temp directory and copy files
    console.log('Setting up temporary directory...');
    await new Promise((resolve, reject) => {
      exec(`mkdir -p ${scraperPath} && cp -r ${path.join(process.cwd(), 'scraper')}/* ${scraperPath}/`, (error, stdout, stderr) => {
        if (error) {
          console.error('Failed to setup directory:', error);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });

    // Step 1: Run scraper/index.js directly (assuming dependencies are pre-installed)
    console.log('Running scraper/index.js...');
    await new Promise((resolve, reject) => {
      exec('node index.js', {
        cwd: scraperPath,
        env: {
          ...process.env,
          PATH: process.env.PATH
        }
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

    // Step 2: Run Python script (assuming dependencies are pre-installed)
    console.log('Running genai_description_genrator.py...');
    await new Promise((resolve, reject) => {
      exec('python3 genai_description_genrator.py', {
        cwd: scraperPath,
        env: {
          ...process.env,
          PATH: process.env.PATH,
          PYTHONPATH: process.env.PYTHONPATH
        }
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

    // Cleanup
    await new Promise((resolve) => {
      exec(`rm -rf ${scraperPath}`, () => resolve());
    });

    console.log('All tasks completed successfully');

    res.status(200).json({ 
      success: true,
      message: 'Sequential execution completed successfully',
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
