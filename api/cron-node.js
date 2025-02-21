// api/cron-node.js
import { exec } from "child_process";
import path from "path";

export default async function handler(req, res) {
  try {
    console.log("Starting cron job execution...");

    const scraperPath = path.join(process.cwd(), "scraper");
    console.log("Scraper path:", scraperPath);

    // Step 1: Run Node.js scraper
    console.log("Running scraper/index.js...");
    await new Promise((resolve, reject) => {
      exec(
        `/var/lang/bin/node index.js`,
        {
          cwd: scraperPath,
        },
        (error, stdout, stderr) => {
          if (error) {
            console.error("Node Scraper Error:", error);
            reject(error);
          } else {
            console.log("Node Scraper Output:", stdout);
            if (stderr) console.error("Node Scraper stderr:", stderr);
            resolve(stdout);
          }
        }
      );
    });

    res.status(200).json({
      success: true,
      message: "execution completed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron execution failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
