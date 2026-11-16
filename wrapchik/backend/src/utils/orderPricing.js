const Product = require('../models/Product');

const calculateVerifiedItems = async items => {
  const verifiedItems = [];
  let subtotal = 0;
  for (const requested of items) {
    const product = await Product.findById(requested.productId);
    if (!product) throw Object.assign(new Error(`Product not found: ${requested.name || requested.productId}`), { statusCode: 404 });
    if (!product.available) throw Object.assign(new Error(`Item "${product.name}" is currently unavailable/out of stock.`), { statusCode: 400 });
    let unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw Object.assign(new Error(`Price for "${product.name}" is invalid`), { statusCode: 400 });
    if (requested.customizations !== undefined && !Array.isArray(requested.customizations)) throw Object.assign(new Error(`Invalid customization data for "${product.name}"`), { statusCode: 400 });
    const selected = [];
    const names = new Set();
    for (const customization of requested.customizations || []) {
      if (!customization || typeof customization.name !== 'string' || names.has(customization.name)) throw Object.assign(new Error(`Invalid or duplicate customization for "${product.name}"`), { statusCode: 400 });
      names.add(customization.name);
      const match = product.customizations.find(option => option.name === customization.name);
      if (!match) throw Object.assign(new Error(`A selected customization is no longer available for "${product.name}"`), { statusCode: 400 });
      const optionPrice = Number(match.price);
      if (!Number.isFinite(optionPrice) || optionPrice < 0) throw Object.assign(new Error(`Price for a customization of "${product.name}" is invalid`), { statusCode: 400 });
      unitPrice += optionPrice;
      selected.push({ name: match.name, price: optionPrice });
    }
    const quantity = Number(requested.quantity);
    const itemTotal = unitPrice * quantity;
    if (!Number.isFinite(itemTotal) || itemTotal > Number.MAX_SAFE_INTEGER) throw Object.assign(new Error(`Order amount for "${product.name}" is invalid`), { statusCode: 400 });
    subtotal += itemTotal;
    if (!Number.isFinite(subtotal) || subtotal > Number.MAX_SAFE_INTEGER / 100) throw Object.assign(new Error('The calculated order subtotal is invalid'), { statusCode: 400 });
    verifiedItems.push({ productId: product._id, name: product.name, priceAtPurchase: unitPrice, quantity, customizations: selected, itemTotal });
  }
  return { verifiedItems, subtotal };
};

module.exports = { calculateVerifiedItems };
