const {GoogleGenerativeAI} = require("@google/generative-ai");
const {Product, Category, Order} = require("../models");
const NodeCache = require("node-cache");

const CONFIG = {
  // Gemini Configuration (Vision Tasks)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    textModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    visionModel: "gemini-2.5-flash",
  },

  // Groq Configuration (Text Tasks)
  groq: {
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: process.env.GROQ_API_KEY,
    models: {
      primary: "llama-3.3-70b-versatile", // Best quality (12K TPM)
      search: "meta-llama/llama-4-scout-17b-16e-instruct", // High throughput (30K TPM)
      fast: "llama-3.1-8b-instant", // Fastest response (6K TPM)
    },
  },

  // Cache Configuration
  cache: {
    ttl: 1800, // 30 minutes
    checkPeriod: 300, // 5 minutes
  },
};

// Initialize providers
const genAI = new GoogleGenerativeAI(CONFIG.gemini.apiKey);
const geminiTextModel = genAI.getGenerativeModel({
  model: CONFIG.gemini.textModel,
});
const geminiVisionModel = genAI.getGenerativeModel({
  model: CONFIG.gemini.visionModel,
});
const cache = new NodeCache({
  stdTTL: CONFIG.cache.ttl,
  checkperiod: CONFIG.cache.checkPeriod,
});

const PROMPTS = {
  chatAgent: (
    context = {}
  ) => `You are DealBot, an AI shopping assistant for BestDeal electronics store.

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
- "newest" or "latest" → Sort by newest arrivals

### Special Commands
- [PRODUCTS]{"action":"get_deals"} [/PRODUCTS] → Show current deals/sale items
- [PRODUCTS]{"action":"get_featured"} [/PRODUCTS] → Show featured/recommended items
- [PRODUCTS]{"action":"get_latest"} [/PRODUCTS] → Show newest arrivals
- [ORDER_TRACK]{"orderId":"ID"} [/ORDER_TRACK] → Track an order by its ID

## USER CONTEXT
- Name: ${context.userName || "Guest"}
${
  context.recentOrders
    ? `- Recent Orders: ${JSON.stringify(context.recentOrders)}`
    : ""
}

## RESPONSE GUIDELINES
1. Be friendly, helpful, and concise (under 100 words)
2. Use emojis sparingly for personality
3. When asked about products, USE THE TOOLS to show them
4. For questions about shipping/returns/warranty, answer directly
5. If you can't find something, suggest alternatives`,

  // Prompt to parse search queries
  smartSearch: (
    query,
    categories,
    brands
  ) => `Parse this search query for an electronics store: "${query}"

Available categories: ${categories.slice(0, 20).join(", ")}
Available brands: ${brands.slice(0, 20).join(", ")}

Return JSON only:
{
  "keywords": ["extracted", "clean", "keywords"],
  "category": "strictly match one from list above or null",
  "brand": "strictly match one from list above or null",
  "maxPrice": number_or_null,
  "sortBy": "price_asc|price_desc|rating|null"
}`,

  // Prompt for purchase-history insights
  purchaseAnalysis: (
    items
  ) => `Analyze this customer's purchase history for an electronics store:
${JSON.stringify(items)}

Return JSON:
{
  "profile": "Brief customer type description (e.g., 'Gaming enthusiast', 'Apple ecosystem user')",
  "suggestions": ["Suggested product 1", "Suggested product 2", "Suggested product 3"],
  "message": "Personalized, friendly recommendation message"
}`,

  // Prompt for product descriptions
  productDescription: (prompt) => `You are an expert e-commerce copywriter.
    
Write a compelling, SEO-friendly product description based on these details: "${prompt}"

Instructions:
- Highlight key features and benefits
- Do NOT include intro/outro text, just the description`,

  // Prompt for SEO product tags
  productTags: (prompt) => `You are an SEO specialist.
    
Generate 5-8 relevant, high-traffic product tags for: "${prompt}"

Instructions:
- Output ONLY a comma-separated list of tags (e.g., Wireless, Bluetooth, Noise Cancelling, Gaming)
- Do NOT include numbering, bullet points, or extra text
- Keep tags concise (1-2 words mostly)
- Focus on features, category, and use-case`,
};

// FAQ responses without AI
const FAQ_RESPONSES = {
  shipping:
    "📦 Free shipping on orders over $500! Standard delivery takes 3-5 business days.",
  return:
    "↩️ We offer a 30-day money-back guarantee. Contact support to initiate a return.",
  warranty:
    "🛡️ All electronics come with a 1-year standard warranty. Extended warranties available.",
  payment:
    "💳 We accept all major credit cards via Stripe. Your payment is 100% secure.",
  "track order":
    "📍 Track your orders at /orderhistory. Each order shows real-time status updates.",
  contact:
    "📧 Email us at support@bestdeal.com or use the chat for instant help!",
};

// AI tools used by the chat agent
const AI_TOOLS = {
  // Search products with smart sorting
  searchProducts: async (query, limit = 5) => {
    const lowerQuery = query.toLowerCase();
    let sort = {rating: -1};
    let searchQuery = query;

    // Parse sorting keywords
    const sortPatterns = [
      {
        pattern: /cheap|lowest|budget|price:?\s*low/i,
        sort: {"variants.salePrice": 1, "variants.regularPrice": 1},
        remove: /cheap(est)?|lowest|budget|price:?\s*low(est)?/gi,
      },
      {
        pattern: /expensive|premium|price:?\s*high|highest\s*price/i,
        sort: {"variants.salePrice": -1, "variants.regularPrice": -1},
        remove: /expensive|premium|price:?\s*high(est)?|highest\s*price/gi,
      },
      {
        pattern: /best|top\s*rated|rating:?\s*high/i,
        sort: {rating: -1},
        remove: /best|top\s*rated|rating:?\s*high(est)?/gi,
      },
      {
        pattern: /popular|selling|most\s*sold/i,
        sort: {"variants.sells": -1},
        remove: /popular|selling|most\s*sold/gi,
      },
      {
        pattern: /newest|latest|recent/i,
        sort: {createdAt: -1},
        remove: /newest|latest|recent/gi,
      },
    ];

    for (const {pattern, sort: sortVal, remove} of sortPatterns) {
      if (lowerQuery.match(pattern)) {
        sort = sortVal;
        searchQuery = searchQuery.replace(remove, "").trim() || "";
        break;
      }
    }

    // Build search filter
    const filter = {"variants.stock": {$gt: 0}};
    if (searchQuery.length > 0) {
      // Find category IDs that match the search query
      const matchingCategories = await Category.find({
        name: new RegExp(searchQuery, "i"),
      }).select("_id");
      const categoryIds = matchingCategories.map((c) => c._id);

      filter.$or = [
        {name: new RegExp(searchQuery, "i")},
        {brand: new RegExp(searchQuery, "i")},
        {category: {$in: categoryIds}},
        {subCategory: {$in: categoryIds}},
        {tags: new RegExp(searchQuery, "i")},
      ];
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .sort(sort)
      .limit(limit);

    return products.map((p) => {
      const bestVariant = p.variants[0]; // Simplified for AI tool
      return {
        id: p._id,
        name: p.name,
        price: bestVariant.salePrice || bestVariant.regularPrice,
        regularPrice: bestVariant.regularPrice,
        image: p.images[0] || p.image, // Fallback to old field image if new images array is empty
        brand: p.brand,
        category: p.category?.name,
        rating: p.rating,
        link: `/productDetails/${p._id}/${encodeURIComponent(
          p.name.replace(/\s+/g, "-")
        )}`,
      };
    });
  },

  // Fetch products currently on sale
  getDeals: async (limit = 5) => {
    const products = await Product.find({
      variants: {$elemMatch: {salePrice: {$gt: 0}}},
      "variants.stock": {$gt: 0},
    })
      .sort({"variants.salePrice": 1})
      .limit(limit);

    return products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.variants[0].salePrice,
      regularPrice: p.variants[0].regularPrice,
      discount: Math.round(
        (1 - p.variants[0].salePrice / p.variants[0].regularPrice) * 100
      ),
      image: p.images[0],
      link: `/productDetails/${p._id}/${encodeURIComponent(
        p.name.replace(/\s+/g, "-")
      )}`,
    }));
  },

  // Fetch featured products
  getFeaturedProducts: async (limit = 5) => {
    const products = await Product.find({
      "flags.featured": true,
      "variants.stock": {$gt: 0},
    }).limit(limit);
    return products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.variants[0].salePrice || p.variants[0].regularPrice,
      image: p.images[0],
      link: `/productDetails/${p._id}/${encodeURIComponent(
        p.name.replace(/\s+/g, "-")
      )}`,
    }));
  },

  // Fetch newest in-stock products
  getLatestProducts: async (limit = 5) => {
    const products = await Product.find({"variants.stock": {$gt: 0}})
      .sort({createdAt: -1})
      .limit(limit);
    return products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.variants[0].salePrice || p.variants[0].regularPrice,
      image: p.images[0],
      link: `/productDetails/${p._id}/${encodeURIComponent(
        p.name.replace(/\s+/g, "-")
      )}`,
    }));
  },

  // List active categories
  getCategories: async () => {
    const categories = await Category.find({isActive: true}).select(
      "name slug"
    );
    return categories.map((cat) => ({
      name: cat.name,
      link: `/category/${cat.slug}`,
    }));
  },

  // Fetch product details by id
  getProductDetails: async (productId) => {
    const product = await Product.findById(productId).populate(
      "category",
      "name"
    );
    if (!product) return null;
    const variant = product.variants[0];
    return {
      id: product._id,
      name: product.name,
      price: variant.salePrice || variant.regularPrice,
      image: product.images[0],
      brand: product.brand,
      category: product.category?.name,
      rating: product.rating,
      specs: product.specifications
        ?.slice(0, 5)
        .map((s) => `${s.key}: ${s.value}`),
      link: `/productDetails/${product._id}/${encodeURIComponent(
        product.name.replace(/\s+/g, "-")
      )}`,
    };
  },

  // List brands optionally filtered by category
  getBrands: async (categoryName) => {
    let query = {"variants.stock": {$gt: 0}};
    if (categoryName) {
      const cat = await Category.findOne({name: new RegExp(categoryName, "i")});
      if (cat) query.category = cat._id;
    }
    const brands = await Product.distinct("brand", query);
    return brands.filter(Boolean);
  },

  // Track order status
  trackOrder: async (orderId) => {
    if (!orderId) return {error: "Order ID is missing"};
    const order = await Order.findOne({
      $or: [
        {orderId: orderId},
        {_id: mongoose.isValidObjectId(orderId) ? orderId : null},
      ],
    });
    if (!order) return {error: "Order not found"};
    return {
      status: order.orderStatus,
      date: order.createdAt,
      total: order.amount,
      items: order.items.length,
      tracking: order.courierInfo?.trackingCode || "Not available yet",
    };
  },
};

// AI request logging helper
const logAI = (
  provider,
  model,
  task,
  prompt,
  response,
  durationMs,
  cached = false
) => {
  const timestamp = new Date().toISOString();
  const promptPreview =
    prompt.length > 150 ? prompt.slice(0, 150) + "..." : prompt;
  const responsePreview =
    response.length > 200 ? response.slice(0, 200) + "..." : response;

  console.log("\n" + "=".repeat(60));
  console.log(`🤖 AI REQUEST [${timestamp}]${cached ? " [CACHED]" : ""}`);
  console.log("=".repeat(60));
  console.log(`📡 Provider: ${provider.toUpperCase()}`);
  console.log(`🧠 Model: ${model}`);
  console.log(`🎯 Task: ${task}`);
  console.log(`⏱️  Duration: ${durationMs}ms`);
  console.log("-".repeat(60));
  console.log("📝 PROMPT:", promptPreview);
  console.log("-".repeat(60));
  console.log("💬 RESPONSE:", responsePreview);
  console.log("=".repeat(60) + "\n");
};

// Provider abstraction (Groq/Gemini)
// Generate text via Groq API
const generateWithGroq = async (
  prompt,
  modelType = "primary",
  task = "general"
) => {
  const model = CONFIG.groq.models[modelType] || CONFIG.groq.models.primary;
  const startTime = Date.now();

  const response = await fetch(CONFIG.groq.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.groq.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{role: "user", content: prompt}],
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
  const content = data.choices[0]?.message?.content || "";
  logAI("groq", model, task, prompt, content, Date.now() - startTime);

  return content;
};

// Generate text via Gemini API
const generateWithGemini = async (prompt, task = "general") => {
  const startTime = Date.now();
  const result = await geminiTextModel.generateContent(prompt);
  const content = result.response.text();
  logAI(
    "gemini",
    CONFIG.gemini.textModel,
    task,
    prompt,
    content,
    Date.now() - startTime
  );
  return content;
};

// Generate vision response via Gemini
const generateWithVision = async (
  prompt,
  imageBase64,
  mimeType = "image/jpeg"
) => {
  const startTime = Date.now();
  const result = await geminiVisionModel.generateContent([
    prompt,
    {inlineData: {data: imageBase64, mimeType}},
  ]);
  const content = result.response.text();
  logAI(
    "gemini",
    CONFIG.gemini.visionModel,
    "vision",
    prompt,
    content,
    Date.now() - startTime
  );
  return content;
};

// Route AI generation to configured provider
const generateAIContent = async (prompt, task = "general") => {
  const useGroq = process.env.USE_AI === "groq";
  const modelType = task === "search" ? "search" : "primary";

  return useGroq
    ? generateWithGroq(prompt, modelType, task)
    : generateWithGemini(prompt, task);
};

// Public service functions
// Get AI-powered product recommendations (cached)
const getProductRecommendations = async (productId, limit = 4) => {
  const cacheKey = `recs_${productId || "homepage"}_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`📦 [CACHE HIT] Recommendations for ${cacheKey}`);
    return {...cached, fromCache: true};
  }

  try {
    const product = productId ? await Product.findById(productId) : null;
    let query = {"variants.stock": {$gt: 0}};

    if (product) {
      query._id = {$ne: productId};
      query.$or = [{category: product.category}, {brand: product.brand}];
    } else {
      query["flags.featured"] = true;
    }

    let products = await Product.find(query)
      .sort({rating: -1, "variants.sells": -1})
      .limit(limit)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .lean();

    // Fallback if no featured products found for homepage
    if (products.length === 0 && !productId) {
      products = await Product.find({"variants.stock": {$gt: 0}})
        .sort({createdAt: -1})
        .limit(limit)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .lean();
    }

    const result = {
      success: true,
      products,
      aiPowered: false,
      method: "db-optimized",
    };
    cache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Recommendation error:", error);
    return {success: false, products: [], error: error.message};
  }
};

// Smart search with tiered AI fallback
const smartSearch = async (query, limit = 10) => {
  const cacheKey = `search_${query.toLowerCase().trim()}_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`📦 [CACHE HIT] Search for "${query}"`);
    return {...cached, fromCache: true};
  }

  try {
    // Tier 1: Fast keyword search (no AI)
    const matchingCategories = await Category.find({
      name: new RegExp(query, "i"),
    }).select("_id");
    const categoryIds = matchingCategories.map((c) => c._id);

    const keywordResults = await Product.find({
      $or: [
        {name: new RegExp(query, "i")},
        {brand: new RegExp(query, "i")},
        {category: {$in: categoryIds}},
        {tags: new RegExp(query, "i")},
      ],
      "variants.stock": {$gt: 0},
    })
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .sort({rating: -1})
      .limit(limit)
      .lean();

    if (keywordResults.length >= 3) {
      const result = {
        success: true,
        products: keywordResults,
        aiPowered: false,
        tier: 1,
      };
      cache.set(cacheKey, result);
      return result;
    }

    // Tier 2: AI-powered search for complex queries
    console.log(`🔍 [TIER 2] AI search for: "${query}"`);

    const [catDocs, brandList] = await Promise.all([
      Category.find({isActive: true}).select("name").limit(20).lean(),
      Product.distinct("brand", {"variants.stock": {$gt: 0}}),
    ]);

    const categories = catDocs.map((c) => c.name);
    const brands = brandList.filter(Boolean).slice(0, 20);

    const responseText = await generateAIContent(
      PROMPTS.smartSearch(query, categories, brands),
      "search"
    );
    let searchCriteria = {keywords: query.split(" ")};

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) searchCriteria = JSON.parse(jsonMatch[0]);
    } catch {}

    const mongoQuery = {};

    if (searchCriteria.category) {
      const cat = await Category.findOne({
        name: new RegExp(searchCriteria.category, "i"),
      });
      if (cat) mongoQuery.category = cat._id;
    }

    if (searchCriteria.brand)
      mongoQuery.brand = new RegExp(searchCriteria.brand, "i");

    if (searchCriteria.maxPrice) {
      // Complex query: Find variant that matches BOTH stock AND price criteria
      mongoQuery.variants = {
        $elemMatch: {
          stock: {$gt: 0},
          $or: [
            {salePrice: {$gt: 0, $lte: searchCriteria.maxPrice}},
            {regularPrice: {$lte: searchCriteria.maxPrice}},
          ],
        },
      };
    } else {
      // Simple query: Just check if any variant has stock
      mongoQuery["variants.stock"] = {$gt: 0};
    }

    if (searchCriteria.keywords?.length) {
      // AND logic: Product must match ALL keywords for high relevance
      mongoQuery.$and = searchCriteria.keywords
        .filter((k) => k.length > 2) // Ignore tiny words
        .map((k) => ({
          $or: [
            {name: new RegExp(k, "i")},
            {tags: new RegExp(k, "i")},
            {brand: new RegExp(k, "i")},
          ],
        }));
    }

    // Determine sort order
    let sortOrder = {rating: -1};
    if (searchCriteria.sortBy === "price_asc")
      sortOrder = {"variants.regularPrice": 1};
    else if (searchCriteria.sortBy === "price_desc")
      sortOrder = {"variants.regularPrice": -1};
    else if (searchCriteria.sortBy === "rating") sortOrder = {rating: -1};

    let products;
    try {
      products = await Product.find(mongoQuery)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .sort(sortOrder)
        .limit(limit)
        .lean(); // Return plain JS objects to avoid Mongoose document issues

      // Fallback: If strict AND search yields no results and we have keywords, try OR search
      if (products.length === 0 && searchCriteria.keywords?.length > 1) {
        const fallbackQuery = {...mongoQuery};
        delete fallbackQuery.$and;
        fallbackQuery.$or = searchCriteria.keywords.map((k) => ({
          name: new RegExp(k, "i"),
        }));

        products = await Product.find(fallbackQuery)
          .populate("category", "name slug")
          .populate("subCategory", "name slug")
          .sort(sortOrder)
          .limit(limit)
          .lean();
      }
    } catch (queryError) {
      console.error("Query execution error:", queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    const result = {
      success: true,
      products,
      searchCriteria,
      aiPowered: true,
      tier: 2,
    };
    cache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Smart search error:", error);
    return {
      success: false,
      products: [],
      aiPowered: false,
      error: error.message,
    };
  }
};

// Chat agent with tool-calling support
const getAIChatResponse = async (
  userMessage,
  chatHistory = [],
  context = {}
) => {
  try {
    const lowerMessage = userMessage.toLowerCase();

    // Check FAQ cache first (instant response, no AI)
    for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
      if (lowerMessage.includes(keyword)) {
        console.log(`💬 [FAQ HIT] "${keyword}"`);
        return {success: true, message: response, provider: "faq-cache"};
      }
    }

    // Handle image uploads with Gemini Vision
    if (context.imageBase64) {
      const response = await generateWithVision(
        `You are DealBot for BestDeal electronics. Analyze this image and help the user. User says: ${userMessage}`,
        context.imageBase64,
        context.imageMimeType || "image/jpeg"
      );
      return {success: true, message: response, provider: "gemini-vision"};
    }

    // Generate chat response
    const useGroq = process.env.USE_AI === "groq";
    const systemPrompt = PROMPTS.chatAgent(context);
    let aiResponse;

    if (useGroq) {
      // Convert chat history to OpenAI format
      const convertedHistory = chatHistory.map((msg) => ({
        role: msg.role === "model" ? "assistant" : msg.role,
        content: msg.parts
          ? msg.parts.map((p) => p.text || "").join("")
          : msg.content || "",
      }));

      const messages = [
        {role: "system", content: systemPrompt},
        ...convertedHistory,
        {role: "user", content: userMessage},
      ];

      const startTime = Date.now();
      const response = await fetch(CONFIG.groq.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.groq.apiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.groq.models.primary,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok)
        throw new Error(`Groq API error: ${await response.text()}`);
      const data = await response.json();
      aiResponse = data.choices[0]?.message?.content || "";
      logAI(
        "groq",
        CONFIG.groq.models.primary,
        "chat",
        userMessage,
        aiResponse,
        Date.now() - startTime
      );
    } else {
      const chat = geminiTextModel.startChat({
        history: [
          {role: "user", parts: [{text: systemPrompt}]},
          {
            role: "model",
            parts: [
              {
                text: "I'm DealBot, ready to help you find the best electronics!",
              },
            ],
          },
          ...chatHistory,
        ],
      });
      const result = await chat.sendMessage(userMessage);
      aiResponse = result.response.text();
    }

    // Parse and execute tool calls
    const productMatch = aiResponse.match(
      /\[PRODUCTS\]([\s\S]*?)\[\/PRODUCTS\]/
    );
    const orderMatch = aiResponse.match(
      /\[ORDER_TRACK\]([\s\S]*?)\[\/ORDER_TRACK\]/
    );
    let products = [];
    let orderDetail = null;

    if (productMatch) {
      try {
        const toolCall = JSON.parse(productMatch[1].trim());
        if (toolCall.action === "show_products" && toolCall.query) {
          const limit = Math.min(toolCall.num || 5, 10);
          products = await AI_TOOLS.searchProducts(toolCall.query, limit);
        } else if (toolCall.action === "get_deals") {
          products = await AI_TOOLS.getDeals(toolCall.num || 5);
        } else if (toolCall.action === "get_featured") {
          products = await AI_TOOLS.getFeaturedProducts(toolCall.num || 5);
        } else if (toolCall.action === "get_latest") {
          products = await AI_TOOLS.getLatestProducts(toolCall.num || 5);
        }
      } catch (e) {
        console.error("Product tool error:", e);
      }
      aiResponse = aiResponse
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/, "")
        .trim();
    }

    if (orderMatch) {
      try {
        const toolCall = JSON.parse(orderMatch[1].trim());
        if (toolCall.orderId) {
          orderDetail = await AI_TOOLS.trackOrder(toolCall.orderId);
        }
      } catch (e) {
        console.error("Order tool error:", e);
      }
      aiResponse = aiResponse
        .replace(/\[ORDER_TRACK\][\s\S]*?\[\/ORDER_TRACK\]/, "")
        .trim();
    }

    return {
      success: true,
      message: aiResponse,
      products: products.length > 0 ? products : undefined,
      orderDetail: orderDetail || undefined,
      provider: useGroq ? "groq" : "gemini",
    };
  } catch (error) {
    console.error("AI Chat Error:", error);
    return {
      success: false,
      message: "I'm having trouble connecting. Please try again! 🔌",
      error: error.message,
    };
  }
};

// Analyze recent purchase history with AI
const analyzePurchaseHistory = async (email) => {
  try {
    const {Order} = require("../models");
    const orders = await Order.find({email}).sort({createdAt: -1}).limit(10);

    if (orders.length === 0) {
      return {success: true, message: "No purchase history yet."};
    }

    const items = orders
      .flatMap((o) => o.items.map((i) => i.name))
      .slice(0, 15);
    const responseText = await generateAIContent(
      PROMPTS.purchaseAnalysis(items),
      "analysis"
    );
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : {profile: "Valued Customer", suggestions: [], message: responseText};

    return {success: true, analysis};
  } catch (error) {
    console.error("Purchase analysis error:", error);
    return {success: false, error: error.message};
  }
};

// Recommend products based on browsing history
const getHistoryRecommendations = async (recentProductIds, limit = 4) => {
  try {
    const seenProducts = await Product.find({
      _id: {$in: recentProductIds},
    }).select("category brand");
    const products = await Product.find({
      _id: {$nin: recentProductIds},
      $or: [
        {category: {$in: seenProducts.map((p) => p.category).filter(Boolean)}},
        {brand: {$in: seenProducts.map((p) => p.brand).filter(Boolean)}},
      ],
      "variants.stock": {$gt: 0},
    })
      .sort({rating: -1})
      .limit(limit)
      .populate("category", "name slug")
      .populate("subCategory", "name slug");

    return {success: true, products};
  } catch (error) {
    return {success: false, error: error.message};
  }
};

// Generate product description via AI

const generateProductDescription = async (prompt) => {
  try {
    const description = await generateAIContent(
      PROMPTS.productDescription(prompt),
      "primary"
    );
    return {success: true, description};
  } catch (error) {
    console.error("Description generation error:", error);
    return {success: false, error: "Failed to generate description"};
  }
};

// Generate product tags via AI
const generateProductTags = async (prompt) => {
  try {
    const text = await generateAIContent(
      PROMPTS.productTags(prompt),
      "primary"
    );
    // Clean and split the response into an array
    const tags = text
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return {success: true, tags};
  } catch (error) {
    console.error("Tag generation error:", error);
    return {success: false, error: "Failed to generate tags"};
  }
};

// Module exports

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
