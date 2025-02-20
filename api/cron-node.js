// api/cron-node.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const findPythonPath = async () => {
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      exec('which python3', (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
    return stdout.trim();
  } catch (error) {
    console.log('Error finding python path:', error);
    // Default paths to try
    return '/usr/bin/python3';
  }
};

export default async function handler(req, res) {
  try {
    console.log('Starting cron job execution...');
    
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

    // Step 2: Find Python path and run Python script
    console.log('Finding Python path...');
    const pythonPath = await findPythonPath();
    console.log('Python path:', pythonPath);

    console.log('Running genai_description_genrator.py...');
    await new Promise((resolve, reject) => {
      exec(`${pythonPath} genai_description_genrator.py`, {
        cwd: scraperPath,
        shell: '/bin/bash',
        env: {
          ...process.env,
          PATH: '/var/lang/bin:/usr/local/bin:/usr/bin:/bin:/opt/bin',
          PYTHONPATH: process.env.PYTHONPATH || '',
          PYTHONUNBUFFERED: '1'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Python Script Error:', error);
          // Try alternative Python command if first attempt fails
          exec('python3 genai_description_genrator.py', {
            cwd: scraperPath,
            shell: '/bin/bash',
            env: {
              ...process.env,
              PATH: '/var/lang/bin:/usr/local/bin:/usr/bin:/bin:/opt/bin',
              PYTHONPATH: process.env.PYTHONPATH || '',
              PYTHONUNBUFFERED: '1'
            }
          }, (error2, stdout2, stderr2) => {
            if (error2) {
              reject(error2);
            } else {
              console.log('Python Script Output (alternative):', stdout2);
              if (stderr2) console.error('Python Script stderr:', stderr2);
              resolve(stdout2);
            }
          });
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
