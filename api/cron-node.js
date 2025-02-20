// api/cron-node.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  try {
    console.log('Starting cron job execution...');
    
    // Get absolute path to scraper directory
    const scraperPath = path.join(process.cwd(), 'scraper');
    console.log('Scraper path:', scraperPath);

    // Step 1: Run Node.js scraper
    console.log('Running scraper/index.js...');
    await new Promise((resolve, reject) => {
      exec(`/var/lang/bin/node index.js`, {
        cwd: scraperPath,
        shell: '/bin/bash',
        env: {
          ...process.env,
          PATH: '/var/lang/bin:/usr/local/bin:/usr/bin:/bin:/opt/bin'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Node Scraper Error:', error);
          reject(error);
        } else {
          console.log('Node Scraper Output:', stdout);
          if (stderr) console.error('Node Scraper stderr:', stderr);
          resolve(stdout);
        }
      });
    });

    // Step 2: Run Python script
    console.log('Running genai_description_genrator.py...');
    await new Promise((resolve, reject) => {
      exec(`/var/lang/bin/python3 genai_description_genrator.py`, {
        cwd: scraperPath,
        shell: '/bin/bash',
        env: {
          ...process.env,
          PATH: '/var/lang/bin:/usr/local/bin:/usr/bin:/bin:/opt/bin',
          PYTHONPATH: process.env.PYTHONPATH || ''
        }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Python Script Error:', error);
          reject(error);
        } else {
          console.log('Python Script Output:', stdout);
          if (stderr) console.error('Python Script stderr:', stderr);
          resolve(stdout);
        }
      });
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
