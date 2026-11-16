const Issue = require('../models/Issue');
const Order = require('../models/Order');

const createIssue = async (req, res, next) => {
  try {
    const { orderId, category, description } = req.body || {};
    if (!orderId || !category || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ success: false, message: 'orderId, category, and description are required' });
    }
    if (description.trim().length > 1000) return res.status(400).json({ success: false, message: 'Description must be 1,000 characters or fewer.' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only report issues on your own orders' });
    }
    const terminalStatuses = ['COMPLETED', 'DELIVERED', 'SERVED'];
    if (!terminalStatuses.includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Can only report issues on completed orders' });
    }
    const issue = await Issue.create({ orderId, userId: req.user._id, category, description: description.trim() });
    res.status(201).json({ success: true, message: 'Issue reported successfully', issue });
  } catch (error) { next(error); }
};

const getMyIssues = async (req, res, next) => {
  try {
    const issues = await Issue.find({ userId: req.user._id })
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: issues.length, issues });
  } catch (error) { next(error); }
};

const getAllIssues = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const issues = await Issue.find(query)
      .populate('orderId', 'orderNumber totalAmount')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: issues.length, issues });
  } catch (error) { next(error); }
};

const resolveIssue = async (req, res, next) => {
  try {
    const { adminResponse, resolution } = req.body;
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    issue.status = 'RESOLVED';
    if (adminResponse) issue.adminResponse = adminResponse;
    if (resolution) issue.resolution = resolution;
    await issue.save();
    
    // Notify user that their issue was resolved
    const { createNotification } = require('./notificationController');
    await createNotification(issue.userId, 'Issue Resolved', `Your issue report has been resolved: ${adminResponse || 'No additional details'}`, 'SYSTEM', null, `issue:${issue._id}:resolved`);
    
    res.json({ success: true, message: 'Issue resolved', issue });
  } catch (error) { next(error); }
};

module.exports = { createIssue, getMyIssues, getAllIssues, resolveIssue };
