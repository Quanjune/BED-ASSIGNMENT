// controllers/cartController.js
// CONTROLLER layer (Week 4 MVC): handles requests, calls the model, returns JSON.
// try...catch on every action; logs server-side, sends a clean error (Week 4).
// The user is identified by req.user.userId, set by verifyToken (Aswin's auth).
const cartModel = require("../models/cartModel");

// GET /api/cart  -> the logged-in user's cart, with a computed total.
async function getMyCart(req, res) {
  try {
    const items = await cartModel.getCartByUser(req.user.userId);
    const total = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    res.status(200).json({ items, total });
  } catch (err) {
    console.error("getMyCart:", err);
    res.status(500).json({ message: "Error retrieving cart." });
  }
}

// POST /api/cart  -> add a product (or bump quantity if already in cart).
async function addToCart(req, res) {
  try {
    const productId = parseInt(req.body.productId);
    const quantity = req.body.quantity ? parseInt(req.body.quantity) : 1;
    // optionIds: array of chosen addon optionIds, e.g. [3, 7]. Optional.
    const optionIds = Array.isArray(req.body.optionIds)
      ? req.body.optionIds.map(Number).filter(n => !isNaN(n))
      : [];

    const result = await cartModel.addToCart(req.user.userId, productId, quantity, optionIds);
    if (result && result.notFound) {
      return res.status(404).json({ message: "Product not found." });
    }
    if (result && result.invalidOption) {
      return res.status(400).json({ message: "One or more selected options are invalid for this product." });
    }
    res.status(201).json(result);
  } catch (err) {
    console.error("addToCart:", err);
    res.status(500).json({ message: "Error adding to cart." });
  }
}

// PUT /api/cart/:cartItemId  -> change a line's quantity (must own the line).
async function updateQuantity(req, res) {
  try {
    const cartItemId = parseInt(req.params.cartItemId);
    const quantity = parseInt(req.body.quantity);

    const existing = await cartModel.getCartItemById(cartItemId);
    if (!existing) return res.status(404).json({ message: "Cart item not found." });
    // Ownership check: a user may only edit their own cart lines.
    if (String(existing.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You cannot modify another user's cart." });
    }

    res.status(200).json(await cartModel.updateQuantity(cartItemId, quantity));
  } catch (err) {
    console.error("updateQuantity:", err);
    res.status(500).json({ message: "Error updating cart item." });
  }
}

// DELETE /api/cart/:cartItemId  -> remove one line (must own the line).
async function removeCartItem(req, res) {
  try {
    const cartItemId = parseInt(req.params.cartItemId);

    const existing = await cartModel.getCartItemById(cartItemId);
    if (!existing) return res.status(404).json({ message: "Cart item not found." });
    if (String(existing.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You cannot modify another user's cart." });
    }

    await cartModel.removeCartItem(cartItemId);
    res.status(200).json({ message: "Item removed from cart." });
  } catch (err) {
    console.error("removeCartItem:", err);
    res.status(500).json({ message: "Error removing cart item." });
  }
}

// DELETE /api/cart  -> empty the whole cart for the logged-in user.
async function clearCart(req, res) {
  try {
    const rows = await cartModel.clearCart(req.user.userId);
    res.status(200).json({ message: "Cart cleared.", itemsRemoved: rows });
  } catch (err) {
    console.error("clearCart:", err);
    res.status(500).json({ message: "Error clearing cart." });
  }
}

module.exports = {
  getMyCart,
  addToCart,
  updateQuantity,
  removeCartItem,
  clearCart
};