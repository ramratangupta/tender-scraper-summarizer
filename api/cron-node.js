// api/cron-node.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export default async function handler(req, res) {
  try {
    console.log('Starting cron job execution...');

    // Step 1: Run Node.js scraper
    console.log('Running scraper/index.js...');
    const { stdout: nodeOutput, stderr: nodeError } = await execPromise('node index.js', {
      cwd: './scraper'
    });
    console.log('Node.js Output:', nodeOutput);
    if (nodeError) console.error('Node.js Errors:', nodeError);

    // Step 2: Run Python script
    console.log('Running genai_description_genrator.py...');
    const { stdout: pythonOutput, stderr: pythonError } = await execPromise('python3 genai_description_genrator.py', {
      cwd: './scraper'
    });
    console.log('Python Output:', pythonOutput);
    if (pythonError) console.error('Python Errors:', pythonError);

    console.log('All tasks completed successfully');

    res.status(200).json({ 
      success: true,
      message: 'Sequential execution completed successfully',
      nodeOutput,
      pythonOutput,
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
