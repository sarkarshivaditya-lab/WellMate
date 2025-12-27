/**
 * Mental AI is intentionally DISABLED in the Express backend.
 *
 * WellMate uses Convex as the single, authoritative backend
 * for all Mental Health AI interactions.
 *
 * This prevents:
 * - Authentication bypass
 * - Rate-limit bypass
 * - Cost amplification
 * - Unsafe mental-health handling
 *
 * Stage: 14.3.1 — Single Backend Authority
 */

const express = require("express");
const router = express.Router();

// POST /api/ai/mental-coach — DISABLED
router.post("/mental-coach", (_req, res) => {
  return res.status(410).json({
    error: "Mental AI is disabled on this backend.",
    code: "MENTAL_AI_DISABLED",
    message:
      "WellMate uses Convex as the sole authority for Mental Health AI.",
  });
});

module.exports = router;
