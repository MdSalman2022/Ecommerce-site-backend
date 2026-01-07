const { getProductRecommendations, smartSearch, getAIChatResponse, analyzePurchaseHistory, getHistoryRecommendations } = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Get AI-powered product recommendations
 * @route   GET /api/ai/recommendations/:productId
 * @access  Public
 */
const getRecommendations = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 4;

    const result = await getProductRecommendations(productId, limit);
    res.json(result);
});

/**
 * @desc    Smart AI-powered search
 * @route   GET /api/ai/search
 * @access  Public
 */
const aiSearch = asyncHandler(async (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q) {
        return res.status(400).json({ success: false, error: 'Search query is required' });
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
    const { message, history, context } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
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
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    
    const result = await analyzePurchaseHistory(email);
    res.json(result);
});

/**
 * @desc    Get recommendations based on browsing history
 * @route   POST /api/ai/history-recommendations
 * @access  Public
 */
const getHistoryRecs = asyncHandler(async (req, res) => {
    const { productIds, limit = 4 } = req.body;
    if (!productIds || !Array.isArray(productIds)) {
        return res.status(400).json({ success: false, error: 'Product IDs array is required' });
    }

    const result = await getHistoryRecommendations(productIds, limit);
    res.json(result);
});

module.exports = {
    getRecommendations,
    aiSearch,
    chatAIChat,
    analyzeHistory,
    getHistoryRecs,
};
