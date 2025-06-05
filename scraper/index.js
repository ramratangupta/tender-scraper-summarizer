import dotenv from "dotenv";
import axiosP from "axios";
import https from 'https';
const axios = axiosP.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});
import { load } from "cheerio";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "redis";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();
const redis = await createClient({ url: process.env.REDIS_URL }).connect();

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

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
    let rows = $("#tenders tbody tr").toArray();
    // if (process.env.NODE_ENV === "production") {
    //   rows = rows.slice(0, 1);
    // }
    const tendersIds = await getTendersIds();
    let existsCount = 0;
    // Process all rows in parallel using Promise.all
    const tenders = rows.map((element, index) => {
      const tds = $(element).find("td");
      const tenderURL = tds.eq(2).find("a").attr("href");

      if (!tenderURL) {
        console.warn(`Missing tender URL for row ${index + 1}`);
        return null; // Skip this row
      }
      const tenderid = parseInt(tds.eq(1).text().trim());

      try {
        const tenderid = parseInt(tds.eq(1).text().trim());
        if (!tendersIds.has(tenderid)) {
          return {
            tenderid: tenderid,
            title: tds.eq(2).text().trim(),
            lastDate: formatDateMYSQL(tds.eq(3).text().trim()),
            publishDate: formatDateMYSQL(tds.eq(4).text().trim()),
            tenderURL: tenderURL,
          };
        } else {
          existsCount++;
        }
      } catch (error) {
        console.log(`Error checking tender ${tenderid}:`, error);
      }

      return null; // Skip if tender exists or error occurred
    });

    // Filter out null values and empty results
    const validTenders = tenders.filter((tender) => tender !== null);
    if (existsCount > 0) {
      console.log(`Found ${existsCount} existing tenders`);
    }
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
const delay = (s = 30, process = "ML") => {
  console.log(`${process} Waiting for ${s} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
};
async function processTenders() {
  try {
    const tenders = await scrapeWebsite(targetWebsiteUrl);
    if (!tenders || tenders.length === 0) {
      return [];
    }
    const results = [];
    for (const tender of tenders) {
      try {
        console.log(`Tender ${tender.tenderid} Starting progress`);
        const pdfData = await downloadPDF(tender.tenderURL);
        if (!Buffer.isBuffer(pdfData)) {
          throw new Error("Invalid PDF data format");
        }
        // Add specific error handling for PDF parsing
        const data = await pdf(pdfData).catch((error) => {
          throw new Error(`PDF parsing error: ${error.message}`);
        });

        if (!data || !data.text) {
          throw new Error("PDF parsing resulted in empty data");
        }

        tender.raw_description = data.text;
        results.push({
          status: "fulfilled",
          value: tender,
        });
      } catch (error) {
        console.log(`Error processing tender ${tender.tenderid}:`, error);
        results.push({
          status: "rejected",
          reason: error.message,
        });
      }
      await delay(2, "PDF");
    }

    // Filter and process results
    const successfulTenders = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedTenders = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);

    if (failedTenders.length > 0) {
      console.log("Failed to process some tenders:", failedTenders);
    }

    return successfulTenders;
  } catch (error) {
    console.log("Fatal error:", error);
    throw error;
  }
}
function formatDateMYSQL(dateString) {
  //18-02-2025
  const [day, month, year] = dateString.split("-");
  return `${year}-${month}-${day}`;
}
async function createTender(tenderData) {
  try {
    return await redis.set(
      "queue_tender_" + tenderData.tenderid,
      JSON.stringify(tenderData)
    );
  } catch (error) {
    console.log("Error saving tender to redis:", error);
    throw error;
  }
}

async function getTendersIds() {
  try {
    const keys = await redis.keys("*tender*");
    return new Set(
      keys
        .filter((k) => /\d/.test(k))
        .map((k) =>
          parseInt(k.replace("queue_tender_", "").replace("tender:", ""))
        )
    );
  } catch (error) {
    console.log("Error checking database:", error);
    throw error;
  }
}
try {
  try {
    const tendersTobesaved = await processTenders();
    for (const tender of tendersTobesaved) {
      try {
        await createTender(tender);
        console.log(`Tender ${tender.tenderid} saved to redis`);
      } catch (error) {
        console.log("Error saving tender to redis:", error, tender.tenderid);
      }
    }
  } catch (e) {
    console.log("Error processing tenders while create:", e);
  }
  try {
    const tenders = await getUnprocessedTenders();
    console.log("Found unprocessed tenders:", tenders.length);

    for (const redisKey of tenders) {
      try {
        const tenderData = await redis.get(redisKey);
        const tender = parseJSON(tenderData);
        if (tender) {
          console.log("ML Processing tender ID:", tender.tenderid);
          const summary = await generateSummary(tender.raw_description);
          if (summary) {
            if (await updateTenderSummary(tender, summary)) {
              console.log("Successfully processed tender");
              await redis.del(redisKey);
            } else {
              console.log("Failed to update tender");
            }
          }
        }
      } catch (error) {
        console.log("JSONparse1 Error processing tender:", error);
      }
    }
  } catch (error) {
    console.log(error);
  }
} catch (error) {
  console.log("Error processing tenders:", error);
} finally {
  await redis.quit();
  process.exit();
}

//GenAI for tendor processing

function normalizeNewlines(text) {
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");
  const lines = text.split("\n");
  const cleanedLines = lines.map((line) => line.trim());
  return cleanedLines.join("\n").trim();
}

function createChunks(text, chunkSize = 50000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function callGenAI(textPrompt, callCount = 1) {
  const jsonFormat = `{
      "summary": "text here",
      "email": "email here",
      "phone": "number1,number2",
      "requirements": ["req1", "req2"]
  }`;

  const prompt = `
  Analyze this tender document and extract the following information in a valid JSON format:
  1. Brief summary of requirements
  2. Email
  3. Phone
  4. Key Requirements

  Return ONLY the JSON object with no additional text or markdown formatting.
  Use this exact format:
  ${jsonFormat}

  Tender text:
  ${textPrompt}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().replace(/```json|```/g, "");
  } catch (error) {
    if (error.status === 429) {
      console.log("GenAI Quota Exceeded");
      if (callCount > 5) {
        throw new Error("Exit callgen ai after 5 retry");
      }
      const delayTime = 30 + 3 ** callCount;
      await delay(delayTime, "GenAI");
      return callGenAI(textPrompt, callCount + 1);
    }
    console.log(error);
    throw error;
  }
}

async function generateSummary(rawDescription) {
  const textPrompt = normalizeNewlines(rawDescription);
  const chunks = createChunks(textPrompt);
  // if (process.env.NODE_ENV === "production") {
  //   return await callGenAI(chunks[0]);
  // }
  if (chunks.length === 1) {
    await delay();
    return await callGenAI(textPrompt);
  }

  const chunkSummaries = [];
  for (const chunk of chunks) {
    try {
      const chunkSummary = await callGenAI(chunk);
      if (chunkSummary) {
        chunkSummaries.push(chunkSummary);
      }
      await delay();
    } catch (error) {
      console.log("Error processing chunk:", error);
    }
  }
  if (chunkSummaries.length > 0) {
    let formattedSummary = "";
    let formattedRequirements = "";
    let formattedEmails = "";
    let formattedPhones = "";

    for (const chunkSummary of chunkSummaries) {
      try {
        const jsonSummary = parseJSON(chunkSummary);
        if (jsonSummary) {
          if (jsonSummary.summary) {
            formattedSummary += jsonSummary.summary + "\n";
          }
          if (jsonSummary.email) {
            formattedEmails += jsonSummary.email + "\n";
          }
          if (jsonSummary.phone) {
            if (Array.isArray(jsonSummary.phone)) {
              formattedPhones +=
                jsonSummary.phone.filter(Boolean).join(",") + "\n";
            } else {
              formattedPhones += jsonSummary.phone + "\n";
            }
          }
          if (jsonSummary.requirements) {
            if (Array.isArray(jsonSummary.requirements)) {
              formattedRequirements +=
                jsonSummary.requirements.filter(Boolean).join("\n") + "\n";
            }
          }
        }
      } catch (error) {
        console.log("Chunk summary1:", chunkSummary);
        console.log("JSONparse2 Error processing chunk:", error);
        throw error;
      }
    }

    const finalPrompt = `
  Summaries after chunking:
  ${formattedSummary}

  Requirements after chunking:
  ${formattedRequirements}

  Emails after chunking:
  ${formattedEmails}

  Phones after chunking:
  ${formattedPhones}
  `;

    return await callGenAI(finalPrompt);
  } else {
    throw new Error("Chunks not processed");
  }
}

async function updateTenderSummary(tender, summary) {
  try {
    const jsonSummary = parseJSON(summary);
    if (jsonSummary) {
      let formattedSummary = "";
      let formattedRequirements = "";
      let formattedEmails = "";
      let formattedPhones = "";

      if (jsonSummary.summary) {
        formattedSummary = jsonSummary.summary;
      }
      if (jsonSummary.email) {
        formattedEmails = jsonSummary.email;
      }
      if (jsonSummary.phone) {
        formattedPhones = Array.isArray(jsonSummary.phone)
          ? jsonSummary.phone.filter(Boolean).join(",")
          : jsonSummary.phone;
      }
      if (jsonSummary.requirements) {
        formattedRequirements = Array.isArray(jsonSummary.requirements)
          ? jsonSummary.requirements.filter(Boolean).join("\n")
          : jsonSummary.requirements;
      }

      tender.aiml_summary = formattedSummary;
      tender.email = formattedEmails;
      tender.phone = formattedPhones;
      tender.requirements = formattedRequirements;

      await redis.hSet(`tender:${tender.tenderid}`, tender);

      if (tender.lastDate) {
        try {
          const timestamp = Math.floor(
            new Date(tender.lastDate).getTime() / 1000
          );
          await redis.zAdd("tenders:by:date", [
            { score: timestamp, value: String(tender.tenderid) },
          ]);
        } catch (error) {
          console.log(
            `Date conversion error for tender ${tender.tenderid}:`,
            error
          );
        }
      }
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log("JSONparse3", error);
    return false;
  }
}

async function getUnprocessedTenders() {
  try {
    return await redis.keys("queue_tender_*");
  } catch (error) {
    console.log(error);
    throw error;
  }
}
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}
