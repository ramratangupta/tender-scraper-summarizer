
import dotenv from "dotenv";
import axios from "axios";
import { load } from "cheerio";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mysql from "mysql2/promise";
dotenv.config();
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
/**
 * I choosed this becasue it do not require any capatca
 */
const targetWebsiteUrl = "https://home.iitd.ac.in/tenders.php";
async function scrapeWebsite(url) {
  try {
    if (!url) {
      throw new Error("URL is required");
    }

    // Make HTTP request to the website
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.data) {
      throw new Error("No data received from the website");
    }

    const $ = load(response.data);
    const rows = $("#tenders tbody tr").toArray();

    // Process all rows in parallel using Promise.all
    const tenders = await Promise.all(
      rows.map(async (element, index) => {
        const tds = $(element).find("td");
        const tenderURL = tds.eq(2).find("a").attr("href");

        if (!tenderURL) {
          console.warn(`Missing tender URL for row ${index + 1}`);
          return null; // Skip this row
        }
        const tenderid = tds.eq(1).text().trim();

        try {
          const checkDB = await checkTenderExtis(tenderid);         

          // If tender doesn't exist in DB
          if (checkDB[0].length === 0) {
            return {
              tenderid: tenderid,
              title: tds.eq(2).text().trim(),
              lastDate: tds.eq(3).text().trim(),
              publishDate: tds.eq(4).text().trim(),
              tenderURL: tenderURL,
            };
          }
        } catch (error) {
          console.error(`Error checking tender ${tenderid}:`, error);
        }

        return null; // Skip if tender exists or error occurred
      })
    );

    // Filter out null values and empty results
    const validTenders = tenders.filter((tender) => tender !== null);

    if (validTenders.length === 0) {
      console.warn("No new tenders found to process");
    } else {
      console.log(`Found ${validTenders.length} new tenders to process`);
    }

    return validTenders;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `HTTP Error: ${error.response.status} - ${error.response.statusText}`
      );
    }
    throw error;
  }
}
async function downloadPDF(url) {
  try {
    console.log("Downloading PDF from:", url);
    if (!url) {
      throw new Error("PDF URL is required");
    }
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5000, // 5 second timeout
    });
    if (!response.data || response.data.length === 0) {
      throw new Error("Empty PDF received");
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to download PDF: HTTP ${error.response.status}`);
    } else if (error.code === "ECONNABORTED") {
      throw new Error("PDF download timeout");
    }
    throw new Error(`PDF download failed: ${error.message}`);
  }
}
const delay = (s,process) => {
  console.log(`${process} Waiting for ${s} seconds...`);
  return new Promise(resolve => setTimeout(resolve, s*1000))
};
async function processTenders() {
  try {
    const tenders = await scrapeWebsite(targetWebsiteUrl);
    if (!tenders || tenders.length === 0) {
      throw new Error("No tenders found to process");
    }
    const results = [];
    for (const tender of tenders) {
      try {
        console.log(`Tender ${tender.tenderid} Starting progress`)
        const pdfData = await downloadPDF(tender.tenderURL);
        if (!Buffer.isBuffer(pdfData)) {
          throw new Error('Invalid PDF data format');
        }
        // Add specific error handling for PDF parsing
        const data = await pdf(pdfData).catch(error => {
          throw new Error(`PDF parsing error: ${error.message}`);
        });

        if (!data || !data.text) {
          throw new Error('PDF parsing resulted in empty data');
        }
        
        tender.raw_data = data.text;
        results.push({
          status: "fulfilled",
          value: tender,
        });
      } catch (error) {
        console.error(`Error processing tender ${tender.tenderid}:`, error);
        results.push({
          status: "rejected",
          reason: error.message,
        });
      }
      await delay(2,"PDF");
        
    }

    // Filter and process results
    const successfulTenders = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedTenders = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (failedTenders.length > 0) {
      console.error("Failed to process some tenders:", failedTenders);
    }

    return successfulTenders;
  } catch (error) {
    console.error("Fatal error:", error);
    throw error;
  }
}
function formatDateMYSQL(dateString) {
  //18-02-2025
  const [day, month, year] = dateString.split("-");
  return `${year}-${month}-${day}`;
}
async function createTender(tenderData) {
  const sql = `
    INSERT INTO tenders 
    (tenderid, title,raw_description, lastDate, publishDate, tenderURL,status) 
    VALUES ( ?, ?, ?, ?, ?, ?,0)`;
  const params = [
    tenderData.tenderid,
    tenderData.title,
    tenderData.raw_data,
    formatDateMYSQL(tenderData.lastDate),
    formatDateMYSQL(tenderData.publishDate),
    tenderData.tenderURL
  ];
  return pool.query(sql, params);
}

async function checkTenderExtis(tenderid) {
  try {
    const sql = `select  tenderid from tenders where tenderid =?`;
    const params = [tenderid];
    return await pool.query(sql, params);
  } catch (error) {
    console.error("Error checking database:", error);
    throw error;
  }
}

//process.exit()
// Execute
processTenders()
  .then((results) => {
    if (results && results.length > 0) {
      results.forEach((tender) => {
        createTender(tender)
          .then(() =>
            console.log(`Tender ${tender.tenderid} saved successfully`)
          )
          .catch((error) =>
            console.error(`Error saving tender ${tender.tenderid}:`, error)
          );
      });
    } else {
      console.log("No tenders to process");
    }
  })
  .catch((error) => console.error("Application error:", error));
