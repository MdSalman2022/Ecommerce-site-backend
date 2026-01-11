const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

// AI routes
router.get("/recommendations", aiController.getRecommendations);
router.get("/recommendations/:productId", aiController.getRecommendations);
router.post("/personalized-recommendations", aiController.getPersonalizedRecs);
router.delete("/recommendations-cache", aiController.clearRecsCache);
router.get("/token-stats", aiController.getTokenUsageStats);
router.post("/token-stats/reset", aiController.resetTokenUsageStats);
router.get("/search", aiController.aiSearch);
router.post("/chat", aiController.chatAIChat);
router.get("/analyze-history", aiController.analyzeHistory);
router.post("/history-recommendations", aiController.getHistoryRecs);
router.post("/generate-description", aiController.generateDescription);
router.post("/generate-tags", aiController.generateTags);

module.exports = router;
