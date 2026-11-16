const Table = require('../models/Table');

const getTables = async (req, res, next) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    res.json({ success: true, count: tables.length, tables });
  } catch (error) { next(error); }
};

const getAvailableTables = async (req, res, next) => {
  try {
    const tables = await Table.find({ status: 'AVAILABLE' }).select('tableNumber label capacity qrCode status').sort({ tableNumber: 1 });
    res.json({ success: true, count: tables.length, tables });
  } catch (error) { next(error); }
};

const createTable = async (req, res, next) => {
  try {
    const { tableNumber, label, capacity } = req.body;
    if (!Number.isInteger(Number(tableNumber)) || Number(tableNumber) < 1) return res.status(400).json({ success: false, message: 'Table number must be a positive integer' });
    if (capacity !== undefined && (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 50)) return res.status(400).json({ success: false, message: 'Capacity must be an integer from 1 to 50' });
    if (label !== undefined && (typeof label !== 'string' || label.trim().length > 80)) return res.status(400).json({ success: false, message: 'Label must be 80 characters or fewer' });
    if (await Table.exists({ tableNumber: Number(tableNumber) })) return res.status(409).json({ success: false, message: 'That table number already exists' });
    const table = await Table.create({
      tableNumber: Number(tableNumber),
      label: label?.trim() || `Table ${tableNumber}`,
      capacity: capacity === undefined ? 4 : Number(capacity),
      qrCode: `wrapchik://dine-in?table=${tableNumber}`,
    });
    res.status(201).json({ success: true, table });
  } catch (error) { next(error); }
};

const updateTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });
    const { label, capacity, status } = req.body;
    if (label !== undefined) {
      if (typeof label !== 'string' || label.trim().length > 80) return res.status(400).json({ success: false, message: 'Label must be 80 characters or fewer' });
      table.label = label.trim();
    }
    if (capacity !== undefined) {
      if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 50) return res.status(400).json({ success: false, message: 'Capacity must be an integer from 1 to 50' });
      table.capacity = Number(capacity);
    }
    if (status !== undefined) {
      if (!['AVAILABLE', 'OCCUPIED', 'RESERVED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid table status' });
      if (table.currentOrderId && status !== table.status) return res.status(409).json({ success: false, message: 'This table is linked to an active order; its status is managed by the order workflow.' });
      table.status = status;
    }
    await table.save();
    res.json({ success: true, table });
  } catch (error) { next(error); }
};

module.exports = { getTables, getAvailableTables, createTable, updateTable };
