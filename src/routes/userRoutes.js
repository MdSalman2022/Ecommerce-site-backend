const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserByEmail,
  createUser,
  updateCardInfo,
  updateDeliveryInfo,
  getShippingDetails,
  saveShippingDetails,
} = require("../controllers/userController");

/**
 * User Routes
 * Base path: /api/users
 */

// GET routes
router.get("/", getAllUsers);
router.get("/shipping/:email", getShippingDetails);
router.get("/:email", getUserByEmail);

// POST routes
router.post("/", createUser);
router.post("/shipping", saveShippingDetails);

// PUT routes
router.put("/card", updateCardInfo);
router.put("/delivery", updateDeliveryInfo);

module.exports = router;
