// AI-powered personalized recommendation service

const {Product, Category} = require("../models");
const NodeCache = require("node-cache");

const cache = new NodeCache({stdTTL: 1800, checkperiod: 300});

const tokenUsage = {
  total: 0,
  requests: 0,
  lastReset: Date.now(),
  history: [],
};

const CONFIG = {
  cache: {
    personalizedTTL: 1800,
    categoryTTL: 3600,
    featuredTTL: 3600,
  },
  thresholds: {
    minViewsForPersonalization: 2,
    complexPatternCategories: 5,
  },
  scoring: {
    productTypeMatch: 40,
    categoryMatch: 25,
    subCategoryMatch: 20,
    tagOverlap: 6,
    specKeyMatch: 4,
    brandMatchWithType: 5,
    brandMatchAlone: 0,
    priceRangeMatch: 5,
    ratingBonus: 2,
    bestsellerBonus: 5,
    featuredBonus: 3,
  },
};

const PRODUCT_TYPE_KEYWORDS = {
  laptop: ["laptop", "notebook", "macbook", "chromebook", "ultrabook"],
  desktop: ["desktop", "pc", "workstation", "mini pc"],
  monitor: ["monitor", "display", "screen", "curved monitor"],
  keyboard: ["keyboard", "keycap", "mechanical keyboard", "membrane keyboard"],
  mouse: ["mouse", "mice", "gaming mouse", "wireless mouse", "trackpad"],
  headphone: ["headphone", "earphone", "earbuds", "headset", "tws", "anc"],
  speaker: ["speaker", "soundbar", "subwoofer", "bluetooth speaker"],
  cooler: [
    "cooler",
    "cooling",
    "fan",
    "heatsink",
    "aio",
    "radiator",
    "cpu cooler",
    "tower cooler",
  ],
  case: [
    "case",
    "casing",
    "chassis",
    "cabinet",
    "enclosure",
    "tower case",
    "mid tower",
  ],
  psu: ["psu", "power supply", "smps", "modular psu"],
  gpu: [
    "gpu",
    "graphics card",
    "video card",
    "rtx",
    "gtx",
    "radeon",
    "geforce",
  ],
  cpu: [
    "cpu",
    "processor",
    "ryzen",
    "intel core",
    "i5",
    "i7",
    "i9",
    "threadripper",
  ],
  ram: ["ram", "memory", "ddr4", "ddr5", "dimm", "sodimm"],
  storage: ["ssd", "hdd", "nvme", "hard drive", "storage", "m.2", "sata"],
  motherboard: ["motherboard", "mainboard", "mobo", "b550", "x570", "z790"],
  smartphone: [
    "smartphone",
    "phone",
    "mobile",
    "iphone",
    "galaxy",
    "pixel",
    "oneplus",
  ],
  tablet: ["tablet", "ipad", "galaxy tab"],
  tv: ["tv", "television", "smart tv", "oled tv", "qled", "led tv", "4k tv"],
  camera: ["camera", "dslr", "mirrorless", "webcam", "action camera"],
  router: ["router", "wifi", "mesh", "networking", "access point", "modem"],
  ups: ["ups", "uninterruptible", "backup power", "ips"],
  printer: ["printer", "scanner", "laser printer", "inkjet"],
  smartwatch: [
    "smartwatch",
    "smart watch",
    "fitness band",
    "apple watch",
    "galaxy watch",
  ],
  console: [
    "console",
    "playstation",
    "xbox",
    "nintendo",
    "ps5",
    "gaming console",
  ],
  projector: ["projector", "home theater", "dlp", "lcd projector"],
  microphone: ["microphone", "mic", "condenser mic", "usb mic", "xlr"],
  chair: ["gaming chair", "office chair", "ergonomic chair"],
  desk: ["desk", "standing desk", "gaming desk", "computer desk"],
};

const logTokenUsage = (tokens, operation, fingerprint) => {
  tokenUsage.total += tokens;
  tokenUsage.requests += 1;
  const entry = {
    timestamp: new Date().toISOString(),
    tokens,
    operation,
    fingerprint,
    runningTotal: tokenUsage.total,
  };
  tokenUsage.history.push(entry);

  // Keep only last 100 entries
  if (tokenUsage.history.length > 100) {
    tokenUsage.history = tokenUsage.history.slice(-100);
  }
  console.log(
    `🎫 [TOKEN USAGE] ${operation}: ${tokens} tokens | Total: ${tokenUsage.total} | Requests: ${tokenUsage.requests}`
  );
  return entry;
};

/**
 * Get token usage statistics
 */
const getTokenStats = () => {
  const avgPerRequest =
    tokenUsage.requests > 0
      ? Math.round(tokenUsage.total / tokenUsage.requests)
      : 0;
  const uptime = Math.round((Date.now() - tokenUsage.lastReset) / 1000 / 60);

  return {
    totalTokens: tokenUsage.total,
    totalRequests: tokenUsage.requests,
    avgTokensPerRequest: avgPerRequest,
    uptimeMinutes: uptime,
    recentHistory: tokenUsage.history.slice(-10),
  };
};

/**
 * Reset token usage stats
 */
const resetTokenStats = () => {
  tokenUsage.history = [];
  return {success: true, message: "Token stats reset"};
};

/**
 * Infer product type from name, tags, description, and specs
 */
const inferProductType = (product) => {
  const searchText = [
    (product.name || "").toLowerCase(),
    ...(product.tags || []).map((t) => t.toLowerCase()),
    (product.description || "").toLowerCase(),
    ...(product.specifications || []).map((s) =>
      `${s.key} ${s.value}`.toLowerCase()
    ),
  ].join(" ");

  // Check each product type
  for (const [type, keywords] of Object.entries(PRODUCT_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return type;
      }
    }
  }
  return "other";
};

const getPriceRange = (product) => {
  const price =
    product.variants?.[0]?.salePrice ||
    product.variants?.[0]?.regularPrice ||
    0;
  if (price < 5000) return "budget";
  if (price < 20000) return "mid-low";
  if (price < 50000) return "mid";
  if (price < 100000) return "mid-high";
  if (price < 200000) return "premium";
  return "luxury";
};

/**
 * Extract product "DNA" - the essential characteristics for matching
 */
const extractProductDNA = (product) => {
  const productType = inferProductType(product);
  return {
    id: product._id?.toString(),
    categoryId:
      product.category?._id?.toString() || product.category?.toString() || "",
    subCategoryId:
      product.subCategory?._id?.toString() ||
      product.subCategory?.toString() ||
      "",
    categoryName: product.category?.name || "",
    brand: (product.brand || "").toLowerCase(),
    tags: (product.tags || []).map((t) => t.toLowerCase()),
    specKeys: (product.specifications || [])
      .map((s) => (s.key || "").toLowerCase())
      .filter(Boolean),
    priceRange: getPriceRange(product),
    productType,
    name: product.name || "",
  };
};

/**
 * Build activity DNA from user's browsing history
 */
const buildActivityDNA = async (activity) => {
  const viewedProductIds = (activity.recentViews || []).map((v) => v.productId);

  if (viewedProductIds.length === 0) {
    return {
      categories: [],
      subCategories: [],
      priceRanges: [],
      productTypes: [],
      viewedIds: [],
    };
  }

  // Fetch full product details for viewed products
  const viewedProducts = await Product.find({
    _id: {$in: viewedProductIds},
  })
    .populate("category", "name slug")
    .populate("subCategory", "name slug")
    .lean();

  // Extract DNA from each viewed product
  const productDNAs = viewedProducts.map(extractProductDNA);
  // Aggregate into activity DNA with frequency counting
  const tagCounts = {};
  const specKeyCounts = {};

  productDNAs.forEach((dna) => {
    dna.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    dna.specKeys.forEach((key) => {
      specKeyCounts[key] = (specKeyCounts[key] || 0) + 1;
    });
  });

  // Sort tags by frequency
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const sortedSpecKeys = Object.entries(specKeyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const activityDNA = {
    categories: [
      ...new Set(productDNAs.map((d) => d.categoryId).filter(Boolean)),
    ],
    subCategories: [
      ...new Set(productDNAs.map((d) => d.subCategoryId).filter(Boolean)),
    ],
    brands: [...new Set(productDNAs.map((d) => d.brand).filter(Boolean))],
    tags: sortedTags,
    specKeys: sortedSpecKeys,
    priceRanges: [...new Set(productDNAs.map((d) => d.priceRange))],
    productTypes: [
      ...new Set(
        productDNAs.map((d) => d.productType).filter((t) => t !== "other")
      ),
    ],
    viewedIds: viewedProductIds,
    viewedProducts: productDNAs.map((d) => ({
      name: d.name,
      type: d.productType,
      brand: d.brand,
    })),
  };

  console.log(
    `📊 [ACTIVITY DNA] Product Types: [${activityDNA.productTypes.join(
      ", "
    )}] | Top Tags: [${activityDNA.tags
      .slice(0, 5)
      .join(", ")}] | Categories: ${activityDNA.categories.length}`
  );

  return activityDNA;
};

/**
 * Calculate similarity score between user activity and a product
 */
const calculateSimilarityScore = (product, activityDNA) => {
  const productDNA = extractProductDNA(product);
  let score = 0;
  const reasons = [];

  // Skip if already viewed
  if (activityDNA.viewedIds.includes(productDNA.id)) {
    return {
      score: 0,
      reasons: [],
      productType: productDNA.productType,
    };
  }

  // 1. PRODUCT TYPE MATCH (MOST IMPORTANT)
  // This prevents "Asus Cooler" from matching "Asus Case"
  const typeMatches = activityDNA.productTypes.includes(productDNA.productType);
  if (typeMatches) {
    reasons.push(`type:${productDNA.productType}`);
  } else if (
    productDNA.productType !== "other" &&
    activityDNA.productTypes.length > 0
  ) {
    // Penalize wrong product types
  }

  // 2. Category Match
  if (activityDNA.categories.includes(productDNA.categoryId)) {
    score += CONFIG.scoring.categoryMatch;
    reasons.push("category");
  }

  // 3. SubCategory Match
  if (
    productDNA.subCategoryId &&
    activityDNA.subCategories.includes(productDNA.subCategoryId)
  ) {
    reasons.push("subcategory");
  }

  // 4. Tag Overlap (very important)
  const tagOverlap = productDNA.tags.filter((tag) =>
    activityDNA.tags.includes(tag)
  );
  if (tagOverlap.length > 0) {
    score += Math.min(tagOverlap.length, 5) * CONFIG.scoring.tagOverlap; // Cap at 5 tags
    reasons.push(`tags:${tagOverlap.slice(0, 3).join(",")}`);
  }

  // 5. Specification Key Match
  const specOverlap = productDNA.specKeys.filter((key) =>
    activityDNA.specKeys.includes(key)
  );
  if (specOverlap.length > 0) {
    score += Math.min(specOverlap.length, 4) * CONFIG.scoring.specKeyMatch; // Cap at 4 specs
    reasons.push(`specs:${specOverlap.length}`);
  }

  // 6. Brand Match - ONLY if product type also matches
  if (typeMatches && activityDNA.brands.includes(productDNA.brand)) {
    score += CONFIG.scoring.brandMatchWithType;
    reasons.push(`brand:${productDNA.brand}`);
  }

  // 7. Price Range Match
  if (activityDNA.priceRanges.includes(productDNA.priceRange)) {
    score += CONFIG.scoring.priceRangeMatch;
    reasons.push(`price:${productDNA.priceRange}`);
  }

  // 8. Quality Bonuses
  score += (product.rating || 0) * CONFIG.scoring.ratingBonus;
  if (product.flags?.bestseller) {
    score += CONFIG.scoring.bestsellerBonus;
  }
  if (product.flags?.featured) {
    score += CONFIG.scoring.featuredBonus;
  }

  return {score, reasons, productType: productDNA.productType};
};
/**
 * Diversify results to show variety across product types
 */
const diversifyResults = (scoredProducts, limit) => {
  if (scoredProducts.length <= limit) {
    return scoredProducts.map((s) => s.product);
  }

  const result = [];
  const typeCount = {};
  const brandCount = {};
  const typeProducts = {};

  for (const scored of scoredProducts) {
    const type = scored.productType || "other";
    if (!typeProducts[type]) typeProducts[type] = [];
    typeProducts[type].push(scored);
  }

  console.log(
    `🎨 [DIVERSITY] Available types: ${Object.entries(typeProducts)
      .map(([t, items]) => `${t}:${items.length}`)
      .join(", ")}`
  );

  const types = Object.keys(typeProducts);
  const productsPerType = Math.ceil(limit / types.length);

  for (const type of types) {
    if (result.length >= limit) break;
    let added = 0;
    for (const scored of typeProducts[type]) {
      if (result.length >= limit || added >= productsPerType) break;
      const brand = (scored.product.brand || "").toLowerCase();
      if ((brandCount[brand] || 0) < 3) {
        result.push(scored.product);
        typeCount[type] = (typeCount[type] || 0) + 1;
        brandCount[brand] = (brandCount[brand] || 0) + 1;
        added++;
      }
    }
  }

  if (result.length < limit) {
    for (const scored of scoredProducts) {
      if (result.length >= limit) break;
      if (
        !result.find((p) => p._id.toString() === scored.product._id.toString())
      ) {
        result.push(scored.product);
        const type = scored.productType || "other";
        typeCount[type] = (typeCount[type] || 0) + 1;
      }
    }
  }

  console.log(
    `🎨 [DIVERSITY] Final mix: ${Object.entries(typeCount)
      .map(([t, c]) => `${t}:${c}`)
      .join(", ")}`
  );
  return result;
};

const determineTier = (activity) => {
  if (
    !activity ||
    !activity.recentViews ||
    activity.recentViews.length < CONFIG.thresholds.minViewsForPersonalization
  ) {
    return "tier1";
  }

  const categoryCount = Object.keys(activity.categoryInterests || {}).length;

  if (categoryCount >= CONFIG.thresholds.complexPatternCategories) {
    return "tier3";
  }

  return "tier2";
};

/**
 * Tier 1: Featured/Trending products (for new users)
 */
const getTier1Recommendations = async (limit = 4) => {
  const cacheKey = `recs_featured_global_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`📦 [CACHE HIT] Tier 1`);
    return {...cached, fromCache: true};
  }

  try {
    let products = await Product.find({
      "flags.featured": true,
      "variants.stock": {$gt: 0},
    })
      .sort({rating: -1, "variants.sells": -1})
      .limit(limit * 2)
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .lean();

    if (products.length === 0) {
      products = await Product.find({"variants.stock": {$gt: 0}})
        .sort({createdAt: -1})
        .limit(limit)
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .lean();
    }

    // Score and diversify
    const scored = products.map((p) => ({
      product: p,
      score: 0,
      productType: inferProductType(p),
    }));
    const diversified = diversifyResults(scored, limit);

    const result = {
      success: true,
      products: diversified,
      metadata: {
        tier: 1,
        tierName: "featured",
        aiPowered: false,
        tokensUsed: 0,
        reasoning: "Trending and featured products",
      },
    };

    cache.set(cacheKey, result, CONFIG.cache.featuredTTL);
    return result;
  } catch (error) {
    console.error("Tier 1 error:", error);
    return {success: false, products: [], error: error.message};
  }
};

/**
 * Tier 2: Smart DB-based scoring (no AI, intelligent matching)
 */
const getTier2Recommendations = async (activity, limit = 4) => {
  const fingerprint = activity.fingerprint || "unknown";
  const cacheKey = `recs_tier2_smart_${fingerprint}_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`📦 [CACHE HIT] Tier 2 for ${fingerprint}`);
    return {...cached, fromCache: true};
  }

  try {
    const activityDNA = await buildActivityDNA(activity);

    if (
      activityDNA.productTypes.length === 0 &&
      activityDNA.categories.length === 0
    ) {
      console.log(`⚠️ [TIER 2] No meaningful activity, falling back to Tier 1`);
      return getTier1Recommendations(limit);
    }

    // Fetch candidate products with broader query - get more for better diversity
    const candidates = await Product.find({
      _id: {$nin: activityDNA.viewedIds},
      "variants.stock": {$gt: 0},
      $or: [
        {tags: {$in: activityDNA.tags.slice(0, 15)}},
        {"flags.featured": true},
        {"flags.bestseller": true},
      ],
    })
      .limit(Math.max(300, limit * 30)) // Get even more candidates for diversity
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .lean();

    console.log(`📊 [TIER 2] Scoring ${candidates.length} candidates...`);
    // Score each candidate
    const scored = candidates.map((product) => {
      const result = calculateSimilarityScore(product, activityDNA);
      return {product, ...result};
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Log top 15 for debugging
    console.log(`📊 [TIER 2 SCORES] Top 15:`);
    scored.slice(0, 15).forEach((s, i) => {
      console.log(
        `   ${i + 1}. [${s.score}] ${s.product.name.slice(0, 50)}... | Type: ${
          s.productType
        } | ${s.reasons.join(", ")}`
      );
    });

    // Diversify and take top results - use ALL scored products for diversity algorithm
    const topProducts = diversifyResults(scored, limit);

    // Generate reasoning
    let reasoning = "Personalized picks for you";
    const typeNames = activityDNA.productTypes.map(
      (t) => t.charAt(0).toUpperCase() + t.slice(1)
    );
    if (typeNames.length > 0) {
      reasoning = `Based on your interest in ${typeNames
        .slice(0, 2)
        .join(" and ")}`;
    } else if (activityDNA.tags.length > 0) {
      reasoning = `Based on products tagged "${activityDNA.tags
        .slice(0, 2)
        .join('", "')}"`;
    }

    const result = {
      success: true,
      products: topProducts,
      metadata: {
        tierName: "smart-db",
        aiPowered: false,
        tokensUsed: 0,
        reasoning,
        matchedTypes: activityDNA.productTypes,
        matchedTags: activityDNA.tags.slice(0, 5),
        candidatesScored: candidates.length,
      },
    };

    cache.set(cacheKey, result, CONFIG.cache.personalizedTTL);
    return result;
  } catch (error) {
    console.error("Tier 2 error:", error);
    return getTier1Recommendations(limit);
  }
};

/**
 * Tier 3: AI-powered recommendations
 */
const getTier3Recommendations = async (
  activity,
  limit = 4,
  aiService = null
) => {
  const fingerprint = activity.fingerprint || "unknown";
  const cacheKey = `recs_tier3_${fingerprint}_${limit}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`📦 [CACHE HIT] AI recs for ${fingerprint} (0 tokens)`);
    return {
      ...cached,
      fromCache: true,
      metadata: {...cached.metadata, tokensUsed: 0},
    };
  }

  if (!aiService) {
    console.log("⚠️ No AI service, using Tier 2");
    return getTier2Recommendations(activity, limit);
  }

  try {
    const activityDNA = await buildActivityDNA(activity);

    const candidates = await Product.find({
      _id: {$nin: activityDNA.viewedIds},
      "variants.stock": {$gt: 0},
    })
      .limit(100)
      .select("_id name brand category tags specifications")
      .populate("category", "name")
      .lean();

    // Build smart AI prompt
    const prompt = `You are a product recommendation engine. Analyze the user's browsing pattern and select products.

## USER VIEWED THESE PRODUCTS:
${activityDNA.viewedProducts
  .map((p) => `- ${p.name} (Type: ${p.type}, Brand: ${p.brand})`)
  .join("\n")}

## USER'S INTERESTS:
- Product Types: ${activityDNA.productTypes.join(", ") || "various"}
- Top Tags: ${activityDNA.tags.slice(0, 8).join(", ")}
- Price Range: ${activityDNA.priceRanges.join(", ")}

## AVAILABLE PRODUCTS:
${candidates
  .map((p) => {
    const type = inferProductType(p);
    return `- ${p._id}: ${p.name} [Type: ${type}] (${p.brand}, ${
      p.category?.name || "N/A"
    }) Tags: ${(p.tags || []).slice(0, 3).join(", ")}`;
  })
  .join("\n")}

## RULES:
1. You MUST select from DIFFERENT product types to show variety
2. If user viewed laptops AND monitors, recommend BOTH laptops AND monitors
3. Distribute ${limit} products across different types (dont give all laptops)
4. MATCH PRODUCT TYPES from user interests
5. Tag overlap matters more than brand name
6. Dont suggest Asus Case just because user viewed Asus Cooler

Select EXACTLY ${limit} product IDs with variety across types. Return JSON:
{"productIds": ["id1", "id2", ...], "reasoning": "Brief explanation"}`;

    // Estimate tokens
    const inputTokens = Math.round(prompt.length / 4);
    const outputTokens = 150;
    const totalTokens = inputTokens + outputTokens;

    console.log(`🤖 [AI] Sending request (~${totalTokens} tokens estimated)`);

    const aiResponse = await aiService.generateAIContent(prompt, "fast");

    logTokenUsage(totalTokens, "tier3-recommendation", fingerprint);

    // Parse response
    let recommendedIds = [];
    let aiReasoning = "";
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendedIds = parsed.productIds || [];
        aiReasoning = parsed.reasoning || "";
      }
    } catch (e) {
      console.error("AI parse error:", e);
    }

    // Fetch products
    let products = [];
    if (recommendedIds.length > 0) {
      products = await Product.find({
        _id: {$in: recommendedIds},
        "variants.stock": {$gt: 0},
      })
        .populate("category", "name slug")
        .populate("subCategory", "name slug")
        .lean();
    }

    if (products.length < limit) {
      console.log(
        `⚠️ AI returned ${products.length}/${limit} products, using Tier 2 for better diversity`
      );
      return getTier2Recommendations(activity, limit);
    }

    const scored = products.map((p) => ({
      product: p,
      score: 0,
      productType: inferProductType(p),
    }));
    const diversified = diversifyResults(scored, limit);

    const result = {
      success: true,
      products: diversified,
      metadata: {
        tier: 3,
        tierName: "ai-powered",
        aiPowered: true,
        tokensUsed: totalTokens,
        reasoning:
          aiReasoning || "AI-curated picks based on your browsing patterns",
        aiRecommendedCount: recommendedIds.length,
      },
    };

    cache.set(cacheKey, result, CONFIG.cache.personalizedTTL);
    return result;
  } catch (error) {
    console.error("Tier 3 error:", error);
    return getTier2Recommendations(activity, limit);
  }
};

/**
 * Main entry point
 */
const getPersonalizedRecommendations = async (
  activity,
  limit = 4,
  options = {}
) => {
  const {forceAI = false, aiService = null} = options;
  let tier = determineTier(activity);

  if (forceAI && activity?.recentViews?.length > 0) {
    tier = "tier3";
  }

  console.log(
    `🎯 Recommendation Tier: ${tier} for fingerprint: ${
      activity?.fingerprint || "unknown"
    }`
  );

  switch (tier) {
    case "tier1":
      return getTier1Recommendations(limit);
    case "tier2":
      return getTier2Recommendations(activity, limit);
    case "tier3":
      return getTier3Recommendations(activity, limit, aiService);
    default:
      return getTier1Recommendations(limit);
  }
};

/**
 * Clear recommendation cache
 */
const clearRecommendationCache = (fingerprint = null) => {
  if (fingerprint) {
    const keys = cache.keys().filter((k) => k.includes(fingerprint));
    keys.forEach((k) => cache.del(k));
    return {cleared: keys.length};
  }
  cache.flushAll();
  return {cleared: "all"};
};

module.exports = {
  getPersonalizedRecommendations,
  getTier1Recommendations,
  getTier2Recommendations,
  getTokenStats,
  resetTokenStats,
  inferProductType,
  CONFIG,
};
