import express from "express";
import cors from "cors";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Redis connection
const redis = await createClient({
  url: process.env.REDIS_URL,
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

// Convert Express app to Vercel serverless function
export default async function handler(req, res) {
  // Add this to handle Vercel's request format
  if (!req.url) {
    req.url = "/";
  }

  // Add proper error handling for Redis connection
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (error) {
    console.error("Redis connection error:", error);
    return res.status(500).json({
      success: false,
      error: "Database connection error",
    });
  }

  // Handle cleanup on Vercel
  res.on("finish", async () => {
    try {
      if (redis.isOpen) {
        await redis.quit();
      }
    } catch (error) {
      console.error("Error closing Redis connection:", error);
    }
  });

  return app(req, res);
}

app.get("/api/tenders", async (req, res) => {
  try {
    let {
      tenderId,
      keywords,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // If specific tender ID is requested
    if (tenderId) {
      const tender = await redis.hGetAll(`tender:${tenderId}`);
      if (!tender || Object.keys(tender).length === 0) {
        return res.status(404).json({
          success: false,
          error: "Tender not found",
        });
      }
      return res.json({
        success: true,
        data: [tender],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: parseInt(limit),
        },
      });
    }

    // Get all tender IDs with scores
    let allTenderIds = await redis.zRangeWithScores("tenders:by:date", 0, -1);
    
    // Sort by timestamp (descending)
    allTenderIds.sort((a, b) => b.score - a.score);
    
    // If date range is specified, filter the results
    if (startDate && endDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      allTenderIds = allTenderIds.filter(item => 
        item.score >= startTimestamp && item.score <= endTimestamp
      );
    }
    
    let paginatedTenders = [];
    let totalItems = allTenderIds.length;
    
    // If keywords are provided, we need to fetch all data to filter properly
    if (keywords) {
      // Fetch all tenders data for proper filtering
      const allTenderPromises = allTenderIds.map(item => 
        redis.hGetAll(`tender:${item.value}`)
      );
      let allTenders = await Promise.all(allTenderPromises);
      
      // Filter out empty results
      allTenders = allTenders.filter(tender => 
        Object.keys(tender).length > 0
      );
      
      // Apply keyword filter
      const searchTerms = keywords.toLowerCase().split(" ");
      allTenders = allTenders.filter(tender =>
        searchTerms.some(term =>
          tender.title?.toLowerCase().includes(term) ||
          tender.aiml_summary?.toLowerCase().includes(term)
        )
      );
      
      // Recalculate pagination based on filtered results
      totalItems = allTenders.length;
      paginatedTenders = allTenders.slice(offset, offset + parseInt(limit));
    } else {
      // No keyword filtering, apply pagination to IDs before fetching tender data
      const paginatedIds = allTenderIds.slice(offset, offset + parseInt(limit));
      
      // Fetch only the paginated tenders data
      const tenderPromises = paginatedIds.map(item => 
        redis.hGetAll(`tender:${item.value}`)
      );
      paginatedTenders = await Promise.all(tenderPromises);
      
      // Filter out empty results
      paginatedTenders = paginatedTenders.filter(tender => 
        Object.keys(tender).length > 0
      );
    }

    res.json({
      success: true,
      data: paginatedTenders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching tenders:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Single tender endpoint
app.get("/api/tenders/:id", async (req, res) => {
  try {
    const tender = await redis.hGetAll(`tender:${req.params.id}`);

    if (!tender || Object.keys(tender).length === 0) {
      return res.status(404).json({
        success: false,
        error: "Tender not found",
      });
    }

    res.json({
      success: true,
      data: tender,
    });
  } catch (error) {
    console.error("Error fetching tender:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Only start the server if running locally (not on Vercel)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 2900;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing Redis connection...");
  if (redis.isOpen) {
    await redis.quit();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Closing Redis connection...");
  if (redis.isOpen) {
    await redis.quit();
  }
  process.exit(0);
});
