require("dotenv").config();
const express = require("express");
const cors = require("cors");

const aiPhysicalRoutes = require("./routes/aiPhysical");
const aiMentalRoutes = require("./routes/aiMental");
const paymentsRoutes = require("./routes/payments");
const healthRoutes = require("./routes/health");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Request logging in development
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path}`
    );
    next();
  });
}

// Health check
app.use("/health", healthRoutes);

// API routes
app.use("/api/ai", aiPhysicalRoutes);

// Mental AI routes are intentionally mounted but DISABLED
// See routes/aiMental.js — Stage 14.3.1 decision
app.use("/api/ai", aiMentalRoutes);

app.use("/api/payments", paymentsRoutes);

// Error handling (generic, non-PII)
app.use((err, _req, res, _next) => {
  console.error("Express error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    code: err.code || "INTERNAL_ERROR",
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`WellMate backend running on port ${PORT}`);
  console.log(
    `Environment: ${process.env.NODE_ENV || "development"}`
  );
  console.log(
    `CORS allowed origin: ${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }`
  );

  // Warn if OpenAI key is missing
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "⚠️  WARNING: OPENAI_API_KEY not set. Express Mental AI is disabled; Convex is authoritative."
    );
  }
});
