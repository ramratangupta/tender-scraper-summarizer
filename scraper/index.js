import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import axios from "axios";
import { load } from "cheerio";
import pdf from "pdf-parse/lib/pdf-parse.js";
dotenv.config();
// Check if API key exists
if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set in environment variables");
}
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
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
      // Add headers to mimic a real browser request
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    if (!response.data) {
      throw new Error("No data received from the website");
    }
    const $ = load(response.data);
    //title,description, start date, closing date, department, contact info, etc
    const tenders = [];
    $("#tenders tbody tr").each((index, element) => {
      const tds = $(element).find("td");
      const tenderURL = tds.eq(2).find("a").attr("href");
      if (!tenderURL) {
        console.warn(`Missing tender URL for row ${index + 1}`);
        return; // Skip this iteration
      }
      const row = {
        tenderid: tds.eq(1).text().trim(),
        title: tds.eq(2).text().trim(),
        lastDate: tds.eq(3).text().trim(),
        publishDate: tds.eq(4).text().trim(),
        tenderURL: tenderURL,
      };
      tenders.push(row);
    });
    if (tenders.length === 0) {
      console.warn("No tenders found on the page");
    }
    return tenders;
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
async function analyzeTenderContent(text) {
  try {
    if (!text || typeof text !== "string") {
      throw new Error("No text provided for analysis");
    }
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
            Analyze this tender document and extract the following information in a valid JSON format:
            1. Brief summary of requirements
            2. Email
            3. Phone
            4. Key Requirements

            Return ONLY the JSON object with no additional text or markdown formatting.
            Use this exact format:
            {
                "summary": "text here",
                "email": "email here",
                "phone": ["number1", "number2"],
                "requirements": ["req1", "req2"]
            }

            Tender text:
            ${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    try {
      const cleanedResponse = response.replace(/```json|```/g, "").trim();
      const parsedResponse = JSON.parse(cleanedResponse);
      if (!parsedResponse.summary || !parsedResponse.requirements) {
        throw new Error("Invalid response structure");
      }
      return parsedResponse;
    } catch (parseError) {
      throw new Error(parseError.message);
    }
  } catch (error) {
    throw new Error(error.message);
  }
}
async function processTenders() {
  try {
    //const tenders = await scrapeWebsite(targetWebsiteUrl);
    const tenders = [
      {
        tenderid: "4199",
        title: "NOTICE INVITING EXPRESSION OF INTEREST FROM BANKS",
        lastDate: "31-03-2025",
        publishDate: "05-04-2024",
        tenderURL:
          "https://home.iitd.ac.in/public/storage/tenders/4199_EOI_1712294149.pdf",
      },
    ];
    if (!tenders || tenders.length === 0) {
      throw new Error("No tenders found to process");
    }

    const results = await Promise.allSettled(
      tenders.map(async (tender) => {
        try {
          const pdfData = await downloadPDF(tender.tenderURL);
          const data = await pdf(pdfData);
          // Add delay between API calls
          await new Promise((resolve) => setTimeout(resolve, 1000));
          tender.raw_data = data.text;
          tender.llm_analysis = await analyzeTenderContent(data.text);
          return tender;
        } catch (error) {
          console.error(`Error processing tender ${tender.tenderid}:`, error);
          return {
            ...tender,
            error: error.message,
          };
        }
      })
    );

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

// Execute
processTenders()
  .then((results) => console.log("Processed tenders:", results))
  .catch((error) => console.error("Application error:", error));
