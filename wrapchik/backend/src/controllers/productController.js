const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const mongoose = require('mongoose');

const getPopularProducts = async (req, res, next) => {
  try {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const products = await Order.aggregate([
      { $match: { createdAt: { $gte: from }, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalQuantity: { $sum: '$items.quantity' } } },
      { $lookup: { from: Product.collection.name, localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $match: { 'product.available': true } },
      { $sort: { totalQuantity: -1, _id: 1 } },
      { $limit: 4 },
      { $project: { _id: '$product._id', name: '$product.name', price: '$product.price', imageUrl: '$product.imageUrl', isVeg: '$product.isVeg', available: '$product.available', customizations: '$product.customizations', totalQuantity: 1 } },
    ]);
    res.json({ success: true, periodDays: 30, products });
  } catch (error) { next(error); }
};

// @desc    Get all products with filtering & search
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const { search, category, veg, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};

    // Search filter
    if (search) {
      if (typeof search !== 'string' || search.length > 80) return res.status(400).json({ success: false, message: 'Search must be 80 characters or fewer.' });
      const literalSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (literalSearch) query.name = { $regex: literalSearch, $options: 'i' };
    }

    // Category filter
    if (category) {
      query.categoryId = category;
    }

    // Veg filter
    if (veg !== undefined) {
      query.isVeg = veg === 'true';
    }

    // Price filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      const parsedMin = minPrice === undefined ? undefined : Number(minPrice);
      const parsedMax = maxPrice === undefined ? undefined : Number(maxPrice);
      if ((parsedMin !== undefined && (!Number.isFinite(parsedMin) || parsedMin < 0)) || (parsedMax !== undefined && (!Number.isFinite(parsedMax) || parsedMax < 0)) || (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax)) {
        return res.status(400).json({ success: false, message: 'Price range is invalid.' });
      }
      query.price = {};
      if (parsedMin !== undefined) query.price.$gte = parsedMin;
      if (parsedMax !== undefined) query.price.$lte = parsedMax;
    }

    // Sort order
    const sortParams = {};
    if (['price', 'name', 'createdAt'].includes(sortBy)) {
      sortParams[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortParams['createdAt'] = -1;
    }

    const products = await Product.find(query)
      .populate('categoryId', 'name imageUrl')
      .sort(sortParams);

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, categoryId, imageUrl, isVeg, available, customizations } = req.body;

    if (typeof name !== 'string' || !name.trim() || typeof description !== 'string' || !description.trim() || price === undefined || !categoryId || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required product details (name, description, price, categoryId, imageUrl)',
      });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number',
      });
    }
    if ((isVeg !== undefined && typeof isVeg !== 'boolean') || (available !== undefined && typeof available !== 'boolean') || (customizations !== undefined && !Array.isArray(customizations))) {
      return res.status(400).json({ success: false, message: 'Product classification, availability and add-ons have invalid formats' });
    }

    if (!mongoose.isValidObjectId(categoryId)) return res.status(400).json({ success: false, message: 'Invalid category ID provided' });
    // Verify category exists
    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID provided',
      });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      categoryId,
      imageUrl: imageUrl.trim(),
      isVeg: isVeg !== undefined ? isVeg : true,
      available: available !== undefined ? available : true,
      customizations: customizations || [],
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const { name, description, price, categoryId, imageUrl, isVeg, available, customizations } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) return res.status(400).json({ success: false, message: 'Product name is required' });
    if (description !== undefined && (typeof description !== 'string' || !description.trim())) return res.status(400).json({ success: false, message: 'Product description is required' });
    if (imageUrl !== undefined && (typeof imageUrl !== 'string' || !imageUrl.trim())) return res.status(400).json({ success: false, message: 'Product image URL is required' });
    if ((isVeg !== undefined && typeof isVeg !== 'boolean') || (available !== undefined && typeof available !== 'boolean') || (customizations !== undefined && !Array.isArray(customizations))) {
      return res.status(400).json({ success: false, message: 'Product classification, availability and add-ons have invalid formats' });
    }

    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number',
      });
    }

    if (name !== undefined) product.name = typeof name === 'string' ? name.trim() : name;
    if (description !== undefined) product.description = typeof description === 'string' ? description.trim() : description;
    if (price !== undefined) product.price = Number(price);
    if (categoryId !== undefined) {
      if (!mongoose.isValidObjectId(categoryId)) return res.status(400).json({ success: false, message: 'Invalid category ID provided' });
      if (!await Category.exists({ _id: categoryId })) return res.status(400).json({ success: false, message: 'Invalid category ID provided' });
      product.categoryId = categoryId;
    }
    if (imageUrl !== undefined) product.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : imageUrl;
    if (isVeg !== undefined) product.isVeg = isVeg;
    if (available !== undefined) product.available = available;
    if (customizations) product.customizations = customizations;

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Quick toggle product availability
// @route   PATCH /api/products/:id/availability
// @access  Private/Admin
const toggleProductAvailability = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (req.body?.available !== undefined && typeof req.body.available !== 'boolean') {
      return res.status(400).json({ success: false, message: 'available must be a boolean' });
    }
    product.available = req.body?.available === undefined ? !product.available : req.body.available;
    await product.save();

    res.json({
      success: true,
      message: `Product availability set to ${product.available ? 'AVAILABLE' : 'UNAVAILABLE'}`,
      available: product.available,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    await product.deleteOne();

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPopularProducts,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
};
