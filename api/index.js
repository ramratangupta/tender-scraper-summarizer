import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// Database connection configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});
// Convert Express app to Vercel serverless function
export default async function handler(req, res) {
  if (!req.url) {
    req.url = "/";
  }
  return app(req, res);
}

// GET endpoint for fetching tenders with optional filters
app.get("/api/tenders", async (req, res) => {
  try {
    console.log(req.query);
    let {
      tenderId,
      keywords,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;
    let query =
      "SELECT  tenderid, title, aiml_summary, lastDate FROM tenders WHERE status=1";
    let whereClause = "";
    const params = [];
    // Add filters if provided
    if (startDate) {
      whereClause += " AND lastDate >= ?";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND lastDate <= ?";
      params.push(endDate);
    }
    if (tenderId) {
      whereClause += " AND tenderid = ?";
      params.push(tenderId);
    }

    if (keywords) {
      whereClause += " AND (title LIKE ? OR aiml_summary LIKE ?)";
      const searchTerm = `%${keywords}%`;
      params.push(searchTerm, searchTerm);
    }

    // Add pagination
    query += whereClause + " ORDER BY lastDate DESC LIMIT ? OFFSET ?";
    // Execute query
    if (page == "") {
      page = 1;
    }
    const limitNum = parseInt(limit, 10);
    const offsetNum = (parseInt(page, 10) - 1) * limitNum;

    const [results] = await pool.query(query, [...params, limitNum, offsetNum]);

    // Get total count for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM tenders WHERE status=1 ${whereClause}`,
      params
    );
    const totalCount = countResult[0].total;

    res.json({
      success: true,
      data: results,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: Number(limit),
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

// GET endpoint for fetching a single tender by ID
app.get("/api/tenders/:id", async (req, res) => {
  try {
    const [results] = await pool.execute(
      "SELECT * FROM tenders WHERE status=1 and tenderid = ?",
      [req.params.id]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Tender not found",
      });
    }

    res.json({
      success: true,
      data: results[0],
    });
  } catch (error) {
    console.error("Error fetching tender:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

const PORT = process.env.PORT || 2900;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
