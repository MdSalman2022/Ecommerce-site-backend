const {
  getProductRecommendations,
  smartSearch,
  getAIChatResponse,
  analyzePurchaseHistory,
  getHistoryRecommendations,
  generateProductDescription,
  generateProductTags,
  generateAIContent,
} = require("../services/aiService");
const {
  getPersonalizedRecommendations,
  clearRecommendationCache,
  getTokenStats,
  resetTokenStats,
} = require("../services/recommendationService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * @desc    Get AI-powered product recommendations
 * @route   GET /api/ai/recommendations/:productId
 * @access  Public
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const {productId} = req.params;
  const limit = parseInt(req.query.limit) || 4;

  const result = await getProductRecommendations(productId, limit);
  res.json(result);
});

/**
 * @desc    Get personalized recommendations based on user activity
 * @route   POST /api/ai/personalized-recommendations
 * @access  Public
 *
 * Uses tiered approach:
 * - Tier 1: No activity → Featured products (no AI)
 * - Tier 2: Simple patterns → DB-based similar products (no AI)
 * - Tier 3: Complex patterns → AI-powered (cached)
 */
const getPersonalizedRecs = asyncHandler(async (req, res) => {
  const {activity, limit = 10, forceAI = false} = req.body;

  console.log(
    `📊 [API] Received personalized recommendation request with limit: ${limit}`
  );

  const options = {
    forceAI,
    aiService: {generateAIContent},
  };

  const result = await getPersonalizedRecommendations(
    activity,
    parseInt(limit),
    options
  );
  res.json(result);
});

/**
 * @desc    Clear recommendation cache
 * @route   DELETE /api/ai/recommendations-cache
 * @access  Private (Admin)
 */
const clearRecsCache = asyncHandler(async (req, res) => {
  const {fingerprint} = req.body;
  const result = clearRecommendationCache(fingerprint);
  res.json({success: true, ...result});
});

/**
 * @desc    Smart AI-powered search
 * @route   GET /api/ai/search
 * @access  Public
 */
const aiSearch = asyncHandler(async (req, res) => {
  const {q, limit = 10} = req.query;

  if (!q) {
    return res
      .status(400)
      .json({success: false, error: "Search query is required"});
  }

  const result = await smartSearch(q, parseInt(limit));
  res.json(result);
});

/**
 * @desc    AI Shopping Assistant Chat
 * @route   POST /api/ai/chat
 * @access  Public
 */
const chatAIChat = asyncHandler(async (req, res) => {
  const {message, history, context} = req.body;

  if (!message) {
    return res.status(400).json({success: false, error: "Message is required"});
  }

  const result = await getAIChatResponse(message, history, context);
  res.json(result);
});

/**
 * @desc    Analyze user's purchase history
 * @route   GET /api/ai/analyze-history
 * @access  Private
 */
const analyzeHistory = asyncHandler(async (req, res) => {
  const {email} = req.query;
  if (!email)
    return res.status(400).json({success: false, error: "Email is required"});

  const result = await analyzePurchaseHistory(email);
  res.json(result);
});

/**
 * @desc    Get recommendations based on browsing history
 * @route   POST /api/ai/history-recommendations
 * @access  Public
 */
const getHistoryRecs = asyncHandler(async (req, res) => {
  const {productIds, limit = 4} = req.body;
  if (!productIds || !Array.isArray(productIds)) {
    return res
      .status(400)
      .json({success: false, error: "Product IDs array is required"});
  }

  const result = await getHistoryRecommendations(productIds, limit);
  res.json(result);
});

/**
 * @desc    Generate product description
 * @route   POST /api/ai/generate-description
 * @access  Private
 */
const generateDescription = asyncHandler(async (req, res) => {
  const {prompt} = req.body;
  if (!prompt)
    return res.status(400).json({success: false, error: "Prompt is required"});

  const result = await generateProductDescription(prompt);
  res.json(result);
});

/**
 * @desc    Generate product tags
 * @route   POST /api/ai/generate-tags
 * @access  Private
 */
const generateTags = asyncHandler(async (req, res) => {
  const {prompt} = req.body;
  if (!prompt)
    return res.status(400).json({success: false, error: "Prompt is required"});

  const result = await generateProductTags(prompt);
  res.json(result);
});

/**
 * @desc    Get AI token usage statistics
 * @route   GET /api/ai/token-stats
 * @access  Private (Admin)
 */
const getTokenUsageStats = asyncHandler(async (req, res) => {
  const stats = getTokenStats();
  res.json({success: true, ...stats});
});

/**
 * @desc    Reset AI token usage statistics
 * @route   POST /api/ai/token-stats/reset
 * @access  Private (Admin)
 */
const resetTokenUsageStats = asyncHandler(async (req, res) => {
  const result = resetTokenStats();
  res.json(result);
});

module.exports = {
  getRecommendations,
  getPersonalizedRecs,
  clearRecsCache,
  aiSearch,
  chatAIChat,
  analyzeHistory,
  getHistoryRecs,
  generateDescription,
  generateTags,
  getTokenUsageStats,
  resetTokenUsageStats,
};
