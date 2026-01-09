/**
 * ============================================================================
 * AI SERVICE - BestDeal E-Commerce Platform
 * ============================================================================
 * 
 * This module provides AI-powered features using a hybrid architecture:
 * - Groq (LLaMA 3.3 70B) for text-based tasks (chat, search, recommendations)
 * - Google Gemini for vision tasks (image analysis)
 * 
 * Architecture:
 * 1. Provider Abstraction Layer - Unified interface for multiple AI providers
 * 2. Intelligent Caching - 30-minute cache to reduce API costs
 * 3. Tool-Calling System - AI agent can invoke tools for real-time data
 * 4. Tiered Search - Keyword-first approach, AI fallback for complex queries
 * 
 * @author BestDeal Development Team
 * @version 2.0.0
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Product } = require('../models');
const NodeCache = require('node-cache');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * AI Provider Configuration
 * Supports easy switching between providers via environment variables
 */
const CONFIG = {
    // Gemini Configuration (Vision Tasks)
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        textModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        visionModel: 'gemini-2.5-flash',
    },
    
    // Groq Configuration (Text Tasks)
    groq: {
        apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        models: {
            primary: 'llama-3.3-70b-versatile',           // Best quality (12K TPM)
            search: 'meta-llama/llama-4-scout-17b-16e-instruct', // High throughput (30K TPM)
            fast: 'llama-3.1-8b-instant',                 // Fastest response (6K TPM)
        },
    },
    
    // Cache Configuration
    cache: {
        ttl: 1800,        // 30 minutes
        checkPeriod: 300, // 5 minutes
    },
};

// Initialize providers
const genAI = new GoogleGenerativeAI(CONFIG.gemini.apiKey);
const geminiTextModel = genAI.getGenerativeModel({ model: CONFIG.gemini.textModel });
const geminiVisionModel = genAI.getGenerativeModel({ model: CONFIG.gemini.visionModel });
const cache = new NodeCache({ stdTTL: CONFIG.cache.ttl, checkperiod: CONFIG.cache.checkPeriod });

// ============================================================================
// PROMPTS
// ============================================================================

/**
 * Centralized prompt templates for consistent AI behavior
 * These prompts are engineered to produce reliable, structured outputs
 */
const PROMPTS = {
    /**
     * Chat Agent System Prompt
     * Defines the AI assistant's personality, knowledge base, and tool usage
     */
    chatAgent: (context = {}) => `You are DealBot, an AI shopping assistant for BestDeal electronics store.

## STORE KNOWLEDGE

### Website Navigation
- Home: / (featured products, deals, "For You" section)
- Categories: /category/[name] (e.g., /category/laptop)
- Product Details: /productDetails/[id]/[name]
- Search: /search?q=[query]
- Cart: /cart | Wishlist: /wishlist
- My Orders: /orderhistory | Order Details: /orders/[id]

### Store Policies
- Free shipping on orders over $500
- 30-day money-back guarantee
- 1-year warranty on all electronics
- Secure payment via Stripe

### Current Promotions
- Year End Sale: Up to 40% off select items
- Free shipping on all orders this week

## AVAILABLE TOOLS

When you need to show products, use this format in your response:
[PRODUCTS]
{"action":"show_products","query":"search term","num":5}
[/PRODUCTS]

Parameters:
- query: Search term or sorting keyword (required)
- num: Number of products to show, 1-10 (optional, default 5)

Sorting keywords the tool understands:
- "cheapest" or "price: low" → Sort by lowest price
- "expensive" or "price: high" → Sort by highest price
- "best" or "top rated" → Sort by rating
- "popular" or "most sold" → Sort by sales

## USER CONTEXT
- Name: ${context.userName || 'Guest'}
${context.recentOrders ? `- Recent Orders: ${JSON.stringify(context.recentOrders)}` : ''}

## RESPONSE GUIDELINES
1. Be friendly, helpful, and concise (under 100 words)
2. Use emojis sparingly for personality
3. When asked about products, USE THE TOOLS to show them
4. For questions about shipping/returns/warranty, answer directly
5. If you can't find something, suggest alternatives`,

    /**
     * Smart Search Prompt
     * Parses natural language queries into structured search criteria
     */
    smartSearch: (query, categories, brands) => `Parse this search query for an electronics store: "${query}"

Available categories: ${categories.slice(0, 10).join(', ')}
Available brands: ${brands.slice(0, 10).join(', ')}

Return JSON only:
{
  "keywords": ["extracted", "keywords"],
  "category": "matched category or null",
  "brand": "matched brand or null",
  "maxPrice": number_or_null,
  "sortBy": "price_asc|price_desc|rating|null"
}`,

    /**
     * Purchase Analysis Prompt
     * Analyzes customer purchase history for personalized insights
     */
    purchaseAnalysis: (items) => `Analyze this customer's purchase history for an electronics store:
${JSON.stringify(items)}

Return JSON:
{
  "profile": "Brief customer type description (e.g., 'Gaming enthusiast', 'Apple ecosystem user')",
  "suggestions": ["Suggested product 1", "Suggested product 2", "Suggested product 3"],
  "message": "Personalized, friendly recommendation message"
}`,

    /**
     * Product Description Prompt
     * Generates SEO-friendly descriptions
     */
    productDescription: (prompt) => `You are an expert e-commerce copywriter.
    
Write a compelling, SEO-friendly product description based on these details: "${prompt}"

Instructions:
- Highlight key features and benefits
- Do NOT include intro/outro text, just the description`,

    /**
     * Product Tags Prompt
     * Generates a comma-separated list of tags
     */
    productTags: (prompt) => `You are an SEO specialist.
    
Generate 5-8 relevant, high-traffic product tags for: "${prompt}"

Instructions:
- Output ONLY a comma-separated list of tags (e.g., Wireless, Bluetooth, Noise Cancelling, Gaming)
- Do NOT include numbering, bullet points, or extra text
- Keep tags concise (1-2 words mostly)
- Focus on features, category, and use-case`,
};

/**
 * FAQ Responses
 * Instant answers for common questions (no AI needed)
 */
const FAQ_RESPONSES = {
    'shipping':    '📦 Free shipping on orders over $500! Standard delivery takes 3-5 business days.',
    'return':      '↩️ We offer a 30-day money-back guarantee. Contact support to initiate a return.',
    'warranty':    '🛡️ All electronics come with a 1-year standard warranty. Extended warranties available.',
    'payment':     '💳 We accept all major credit cards via Stripe. Your payment is 100% secure.',
    'track order': '📍 Track your orders at /orderhistory. Each order shows real-time status updates.',
    'contact':     '📧 Email us at support@bestdeal.com or use the chat for instant help!',
};

// ============================================================================
// AI TOOLS (Agent Capabilities)
// ============================================================================

/**
 * AI Tools - Functions the chat agent can invoke
 * Each tool returns structured data that gets embedded in chat responses
 */
const AI_TOOLS = {
    /**
     * Search Products Tool
     * Finds products based on query with intelligent sorting
     * 
     * @param {string} query - Search query (supports sorting keywords)
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>} - Array of product objects with links
     */
    searchProducts: async (query, limit = 5) => {
        const lowerQuery = query.toLowerCase();
        let sort = { rating: -1 };
        let searchQuery = query;
        
        // Parse sorting keywords from query
        const sortPatterns = [
            { pattern: /cheap|lowest|budget|price:?\s*low/i, sort: { price: 1 }, remove: /cheap(est)?|lowest|budget|price:?\s*low(est)?/gi },
            { pattern: /expensive|premium|price:?\s*high|highest\s*price/i, sort: { price: -1 }, remove: /expensive|premium|price:?\s*high(est)?|highest\s*price/gi },
            { pattern: /best|top\s*rated|rating:?\s*high/i, sort: { rating: -1 }, remove: /best|top\s*rated|rating:?\s*high(est)?/gi },
            { pattern: /popular|selling|most\s*sold/i, sort: { sells: -1 }, remove: /popular|selling|most\s*sold/gi },
        ];
        
        for (const { pattern, sort: sortVal, remove } of sortPatterns) {
            if (lowerQuery.match(pattern)) {
                sort = sortVal;
                searchQuery = searchQuery.replace(remove, '').trim() || '';
                break;
            }
        }
        
        // Build search filter
        const filter = { stock: true };
        if (searchQuery.length > 0) {
            filter.$or = [
                { name: new RegExp(searchQuery, 'i') },
                { cat: new RegExp(searchQuery, 'i') },
                { brand: new RegExp(searchQuery, 'i') },
            ];
        }
        
        const products = await Product.find(filter)
            .sort(sort)
            .limit(limit)
            .select('_id name price image brand cat rating');
        
        return products.map(p => ({
            id: p._id,
            name: p.name,
            price: p.price,
            image: p.image,
            brand: p.brand,
            category: p.cat,
            rating: p.rating,
            link: `/productDetails/${p._id}/${encodeURIComponent(p.name.replace(/\s+/g, '-'))}`,
        }));
    },
    
    /**
     * Get Categories Tool
     * Returns list of all product categories
     */
    getCategories: async () => {
        const products = await Product.find({ stock: true }).select('cat');
        const cats = [...new Set(products.map(p => p.cat).filter(Boolean))];
        return cats.map(cat => ({ name: cat, link: `/category/${encodeURIComponent(cat)}` }));
    },
    
    /**
     * Get Product Details Tool
     * Fetches detailed info about a specific product
     */
    getProductDetails: async (productId) => {
        const product = await Product.findById(productId);
        if (!product) return null;
        return {
            id: product._id,
            name: product.name,
            price: product.price,
            image: product.image,
            brand: product.brand,
            category: product.cat,
            rating: product.rating,
            specs: product.spec?.slice(0, 5),
            link: `/productDetails/${product._id}/${encodeURIComponent(product.name.replace(/\s+/g, '-'))}`,
        };
    },
    
    /**
     * Get Brands Tool
     * Returns list of brands, optionally filtered by category
     */
    getBrands: async (category) => {
        const query = category ? { cat: new RegExp(category, 'i'), stock: true } : { stock: true };
        const products = await Product.find(query).select('brand');
        return [...new Set(products.map(p => p.brand).filter(Boolean))];
    },
};

// ============================================================================
// LOGGING & MONITORING
// ============================================================================

/**
 * Log AI requests for debugging and analytics
 */
const logAI = (provider, model, task, prompt, response, durationMs, cached = false) => {
    const timestamp = new Date().toISOString();
    const promptPreview = prompt.length > 150 ? prompt.slice(0, 150) + '...' : prompt;
    const responsePreview = response.length > 200 ? response.slice(0, 200) + '...' : response;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🤖 AI REQUEST [${timestamp}]${cached ? ' [CACHED]' : ''}`);
    console.log('='.repeat(60));
    console.log(`📡 Provider: ${provider.toUpperCase()}`);
    console.log(`🧠 Model: ${model}`);
    console.log(`🎯 Task: ${task}`);
    console.log(`⏱️  Duration: ${durationMs}ms`);
    console.log('-'.repeat(60));
    console.log('📝 PROMPT:', promptPreview);
    console.log('-'.repeat(60));
    console.log('💬 RESPONSE:', responsePreview);
    console.log('='.repeat(60) + '\n');
};

// ============================================================================
// PROVIDER ABSTRACTION LAYER
// ============================================================================

/**
 * Generate content using Groq API
 * Uses OpenAI-compatible endpoint for easy migration
 */
const generateWithGroq = async (prompt, modelType = 'primary', task = 'general') => {
    const model = CONFIG.groq.models[modelType] || CONFIG.groq.models.primary;
    const startTime = Date.now();
    
    const response = await fetch(CONFIG.groq.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.groq.apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Groq API Error [${model}]:`, error);
        throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    logAI('groq', model, task, prompt, content, Date.now() - startTime);
    
    return content;
};

/**
 * Generate content using Gemini API
 */
const generateWithGemini = async (prompt, task = 'general') => {
    const startTime = Date.now();
    const result = await geminiTextModel.generateContent(prompt);
    const content = result.response.text();
    logAI('gemini', CONFIG.gemini.textModel, task, prompt, content, Date.now() - startTime);
    return content;
};

/**
 * Generate content with vision capabilities (always uses Gemini)
 */
const generateWithVision = async (prompt, imageBase64, mimeType = 'image/jpeg') => {
    const startTime = Date.now();
    const result = await geminiVisionModel.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType } },
    ]);
    const content = result.response.text();
    logAI('gemini', CONFIG.gemini.visionModel, 'vision', prompt, content, Date.now() - startTime);
    return content;
};

/**
 * Unified AI content generation
 * Routes to appropriate provider based on configuration
 */
const generateAIContent = async (prompt, task = 'general') => {
    const useGroq = process.env.USE_AI === 'groq';
    const modelType = task === 'search' ? 'search' : 'primary';
    
    return useGroq 
        ? generateWithGroq(prompt, modelType, task)
        : generateWithGemini(prompt, task);
};

// ============================================================================
// PUBLIC API - Exported Service Functions
// ============================================================================

/**
 * Get AI-Powered Product Recommendations
 * Uses caching to minimize API calls
 * 
 * @param {string} productId - Product ID to get recommendations for (optional)
 * @param {number} limit - Number of recommendations
 * @returns {Promise<Object>} - Recommendations with metadata
 */
const getProductRecommendations = async (productId, limit = 4) => {
    const cacheKey = `recs_${productId || 'homepage'}_${limit}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
        console.log(`📦 [CACHE HIT] Recommendations for ${cacheKey}`);
        return { ...cached, fromCache: true };
    }

    try {
        const product = productId ? await Product.findById(productId) : null;
        const query = product 
            ? { _id: { $ne: productId }, $or: [{ cat: product.cat }, { brand: product.brand }], stock: true }
            : { stock: true };
        
        const products = await Product.find(query)
            .sort({ rating: -1, sells: -1 })
            .limit(limit)
            .select('name price image brand cat rating stock');

        const result = { success: true, products, aiPowered: false, method: 'db-optimized' };
        cache.set(cacheKey, result);
        
        return result;
    } catch (error) {
        console.error('Recommendation error:', error);
        return { success: false, products: [], error: error.message };
    }
};

/**
 * Smart Search with Natural Language Understanding
 * Tiered approach: keyword search first, AI fallback for complex queries
 * 
 * @param {string} query - User's search query
 * @param {number} limit - Max results
 * @returns {Promise<Object>} - Search results with metadata
 */
const smartSearch = async (query, limit = 10) => {
    const cacheKey = `search_${query.toLowerCase().trim()}_${limit}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
        console.log(`📦 [CACHE HIT] Search for "${query}"`);
        return { ...cached, fromCache: true };
    }

    try {
        // Tier 1: Fast keyword search (no AI)
        const keywordResults = await Product.find({
            $or: [
                { name: new RegExp(query, 'i') },
                { cat: new RegExp(query, 'i') },
                { brand: new RegExp(query, 'i') },
            ],
            stock: true,
        })
        .sort({ rating: -1 })
        .limit(limit)
        .select('name price image brand cat rating stock');

        if (keywordResults.length >= 3) {
            const result = { success: true, products: keywordResults, aiPowered: false, tier: 1 };
            cache.set(cacheKey, result);
            return result;
        }

        // Tier 2: AI-powered search for complex queries
        console.log(`🔍 [TIER 2] AI search for: "${query}"`);
        
        const categories = [...new Set((await Product.find({ stock: true }).select('cat').limit(50)).map(p => p.cat).filter(Boolean))];
        const brands = [...new Set((await Product.find({ stock: true }).select('brand').limit(50)).map(p => p.brand).filter(Boolean))];

        const responseText = await generateAIContent(PROMPTS.smartSearch(query, categories, brands), 'search');
        let searchCriteria = { keywords: query.split(' ') };
        
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) searchCriteria = JSON.parse(jsonMatch[0]);
        } catch {}

        const mongoQuery = { stock: true };
        if (searchCriteria.category) mongoQuery.cat = new RegExp(searchCriteria.category, 'i');
        if (searchCriteria.brand) mongoQuery.brand = new RegExp(searchCriteria.brand, 'i');
        if (searchCriteria.maxPrice) mongoQuery.price = { $lte: searchCriteria.maxPrice };
        if (searchCriteria.keywords?.length) {
            mongoQuery.$or = searchCriteria.keywords.map(k => ({ name: new RegExp(k, 'i') }));
        }

        const products = await Product.find(mongoQuery).sort({ rating: -1 }).limit(limit).select('name price image brand cat rating stock');
        const result = { success: true, products, searchCriteria, aiPowered: true, tier: 2 };
        cache.set(cacheKey, result);
        
        return result;
    } catch (error) {
        console.error('Smart search error:', error);
        return { success: false, products: [], aiPowered: false };
    }
};

/**
 * AI Chat Agent with Tool-Calling Capability
 * Supports text chat and image analysis
 * 
 * @param {string} userMessage - User's message
 * @param {Array} chatHistory - Previous messages for context
 * @param {Object} context - User context (name, orders, etc.)
 * @returns {Promise<Object>} - Response with optional product cards
 */
const getAIChatResponse = async (userMessage, chatHistory = [], context = {}) => {
    try {
        const lowerMessage = userMessage.toLowerCase();
        
        // Check FAQ cache first (instant response, no AI)
        for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
            if (lowerMessage.includes(keyword)) {
                console.log(`💬 [FAQ HIT] "${keyword}"`);
                return { success: true, message: response, provider: 'faq-cache' };
            }
        }

        // Handle image uploads with Gemini Vision
        if (context.imageBase64) {
            const response = await generateWithVision(
                `You are DealBot for BestDeal electronics. Analyze this image and help the user. User says: ${userMessage}`,
                context.imageBase64, context.imageMimeType || 'image/jpeg'
            );
            return { success: true, message: response, provider: 'gemini-vision' };
        }

        // Generate chat response
        const useGroq = process.env.USE_AI === 'groq';
        const systemPrompt = PROMPTS.chatAgent(context);
        let aiResponse;
        
        if (useGroq) {
            // Convert chat history to OpenAI format
            const convertedHistory = chatHistory.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.parts ? msg.parts.map(p => p.text || '').join('') : (msg.content || '')
            }));
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...convertedHistory,
                { role: 'user', content: userMessage },
            ];
            
            const startTime = Date.now();
            const response = await fetch(CONFIG.groq.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.groq.apiKey}`,
                },
                body: JSON.stringify({
                    model: CONFIG.groq.models.primary,
                    messages,
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) throw new Error(`Groq API error: ${await response.text()}`);
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || '';
            logAI('groq', CONFIG.groq.models.primary, 'chat', userMessage, aiResponse, Date.now() - startTime);
        } else {
            const chat = geminiTextModel.startChat({
                history: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: "I'm DealBot, ready to help you find the best electronics! 🛒" }] },
                    ...chatHistory,
                ],
            });
            const result = await chat.sendMessage(userMessage);
            aiResponse = result.response.text();
        }

        // Parse and execute tool calls
        const productMatch = aiResponse.match(/\[PRODUCTS\]([\s\S]*?)\[\/PRODUCTS\]/);
        let products = [];
        
        if (productMatch) {
            try {
                const toolCall = JSON.parse(productMatch[1]);
                if (toolCall.action === 'show_products' && toolCall.query) {
                    const limit = Math.min(toolCall.num || 5, 10); // Default 5, max 10
                    products = await AI_TOOLS.searchProducts(toolCall.query, limit);
                }
            } catch {}
            aiResponse = aiResponse.replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/, '').trim();
        }

        return {
            success: true,
            message: aiResponse,
            products: products.length > 0 ? products : undefined,
            provider: useGroq ? 'groq' : 'gemini',
        };
    } catch (error) {
        console.error('AI Chat Error:', error);
        return {
            success: false,
            message: "I'm having trouble connecting. Please try again! 🔌",
            error: error.message
        };
    }
};

/**
 * Analyze Customer Purchase History
 * Uses AI to generate personalized insights
 * 
 * @param {string} email - Customer email
 * @returns {Promise<Object>} - Analysis with profile and suggestions
 */
const analyzePurchaseHistory = async (email) => {
    try {
        const { Order } = require('../models');
        const orders = await Order.find({ email }).sort({ createdAt: -1 }).limit(10);
        
        if (orders.length === 0) {
            return { success: true, message: "No purchase history yet." };
        }

        const items = orders.flatMap(o => o.cart.map(i => i.name)).slice(0, 15);
        const responseText = await generateAIContent(PROMPTS.purchaseAnalysis(items), 'analysis');
        const analysis = JSON.parse(responseText.match(/\{[\s\S]*\}/)[0]);

        return { success: true, analysis };
    } catch (error) {
        console.error('Purchase analysis error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get Recommendations Based on Browsing History
 * Pure database query (no AI needed)
 * 
 * @param {string[]} recentProductIds - Products user has viewed
 * @param {number} limit - Max recommendations
 * @returns {Promise<Object>} - Recommended products
 */
const getHistoryRecommendations = async (recentProductIds, limit = 4) => {
    try {
        const seenProducts = await Product.find({ _id: { $in: recentProductIds } }).select('cat brand');
        const products = await Product.find({
            _id: { $nin: recentProductIds },
            $or: [
                { cat: { $in: seenProducts.map(p => p.cat) } },
                { brand: { $in: seenProducts.map(p => p.brand) } }
            ],
            stock: true
        })
        .sort({ rating: -1 })
        .limit(limit)
        .select('name price image brand cat rating stock');

        return { success: true, products };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Generate Product Description
 * 
 * @param {string} prompt - User prompt
 * @returns {Promise<Object>} - Generated description
 */
const generateProductDescription = async (prompt) => {
    try {
        const description = await generateAIContent(PROMPTS.productDescription(prompt), 'primary');
        return { success: true, description };
    } catch (error) {
        console.error('Description generation error:', error);
        return { success: false, error: 'Failed to generate description' };
    }
};

/**
 * Generate Product Tags
 * 
 * @param {string} prompt - Product name and description
 * @returns {Promise<Object>} - Generated tags array
 */
const generateProductTags = async (prompt) => {
    try {
        const text = await generateAIContent(PROMPTS.productTags(prompt), 'primary');
        // Clean and split the response into an array
        const tags = text.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        return { success: true, tags };
    } catch (error) {
        console.error('Tag generation error:', error);
        return { success: false, error: 'Failed to generate tags' };
    }
};

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
    // Main service functions
    getProductRecommendations,
    smartSearch,
    getAIChatResponse,
    analyzePurchaseHistory,
    getHistoryRecommendations,
    generateProductDescription,
    generateProductTags,
    
    // Lower-level utilities (for advanced use)
    generateWithVision,
    generateAIContent,
    
    // Expose tools for testing/extension
    AI_TOOLS,
    
    // Expose config for transparency
    CONFIG,
    PROMPTS,
    FAQ_RESPONSES,
};
