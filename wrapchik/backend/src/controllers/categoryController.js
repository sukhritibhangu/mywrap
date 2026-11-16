const Category = require('../models/Category');
const Product = require('../models/Product');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, name: 1 });
    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res, next) => {
  try {
    const { name, imageUrl, displayOrder } = req.body;

    if (typeof name !== 'string' || !name.trim() || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name and image URL are required',
      });
    }
    if (displayOrder !== undefined && (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0)) return res.status(400).json({ success: false, message: 'Display order must be a non-negative integer' });

    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists',
      });
    }

    const category = await Category.create({
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      displayOrder: displayOrder === undefined ? 0 : displayOrder,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res, next) => {
  try {
    const { name, imageUrl, displayOrder } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, message: 'Category name is required' });
      const duplicate = await Category.exists({ name: name.trim(), _id: { $ne: category._id } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Category with this name already exists' });
      category.name = name.trim();
    }
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string' || !imageUrl.trim()) return res.status(400).json({ success: false, message: 'Category image URL is required' });
      category.imageUrl = imageUrl.trim();
    }
    if (displayOrder !== undefined) {
      if (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0) return res.status(400).json({ success: false, message: 'Display order must be a non-negative integer' });
      category.displayOrder = Number(displayOrder);
    }

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Safety check: Check if products belong to this category
    const associatedProducts = await Product.countDocuments({ categoryId: req.params.id });
    if (associatedProducts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It currently has ${associatedProducts} associated products.`,
      });
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
