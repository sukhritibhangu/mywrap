const GroupOrder = require('../models/GroupOrder');
const crypto = require('crypto');
const mongoose = require('mongoose');

const createGroup = async (req, res, next) => {
  try {
    const { orderType = 'TAKEAWAY', hostel, roomNumber, tableId, maxMembers = 8 } = req.body || {};
    if (!['TAKEAWAY', 'DELIVERY', 'DINE_IN'].includes(orderType)) return res.status(400).json({ success: false, message: 'Invalid group order type.' });
    if (!Number.isInteger(Number(maxMembers)) || Number(maxMembers) < 2 || Number(maxMembers) > 8) return res.status(400).json({ success: false, message: 'Group size must be from 2 to 8 members.' });
    if (orderType === 'DELIVERY' && (typeof hostel !== 'string' || !hostel.trim() || hostel.trim().length > 120 || typeof roomNumber !== 'string' || !roomNumber.trim() || roomNumber.trim().length > 32)) return res.status(400).json({ success: false, message: 'A valid hostel and room are required for a delivery group.' });
    if (orderType === 'DINE_IN' && !mongoose.isValidObjectId(tableId)) return res.status(400).json({ success: false, message: 'A valid table is required for a dine-in group.' });
    const groupCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const group = await GroupOrder.create({
      groupCode,
      leaderId: req.user._id,
      members: [{ userId: req.user._id, name: req.user.name, status: 'JOINED' }],
      orderType,
      hostel,
      roomNumber,
      tableId,
      maxMembers: Number(maxMembers),
    });

    res.status(201).json({ success: true, group });
  } catch (error) { next(error); }
};

const joinGroup = async (req, res, next) => {
  try {
    const groupCode = req.body?.groupCode;
    if (typeof groupCode !== 'string' || !/^[A-F0-9]{6}$/.test(groupCode.trim().toUpperCase())) return res.status(400).json({ success: false, message: 'Enter a valid six-character group code.' });
    const group = await GroupOrder.findOne({ groupCode: groupCode.trim().toUpperCase() });
    
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.status !== 'OPEN') return res.status(400).json({ success: false, message: 'Group is no longer open' });
    
    const activeMembersCount = group.members.filter(m => m.status === 'JOINED').length;
    if (activeMembersCount >= group.maxMembers) {
      return res.status(400).json({ success: false, message: 'Group is full' });
    }

    const existingMember = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (existingMember) {
      if (existingMember.status === 'JOINED') {
        return res.status(400).json({ success: false, message: 'Already joined this group' });
      } else {
        existingMember.status = 'JOINED';
      }
    } else {
      group.members.push({ userId: req.user._id, name: req.user.name, status: 'JOINED' });
    }

    await group.save();
    res.json({ success: true, group });
  } catch (error) { next(error); }
};

const getGroupDetails = async (req, res, next) => {
  try {
    const group = await GroupOrder.findById(req.params.id).populate('members.userId', 'name');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isJoinedMember = group.members.some(member => member.status === 'JOINED' && String(member.userId?._id || member.userId) === String(req.user._id));
    if (!isJoinedMember) return res.status(403).json({ success: false, message: 'Only current group members can view group details.' });
    res.json({ success: true, group });
  } catch (error) { next(error); }
};

const lockGroup = async (req, res, next) => {
  try {
    const group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const leaderIsJoined = group.members.some(member => member.status === 'JOINED' && member.userId.toString() === req.user._id.toString());
    if (group.leaderId.toString() !== req.user._id.toString() || !leaderIsJoined) {
      return res.status(403).json({ success: false, message: 'Only leader can lock the group' });
    }
    if (group.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Only an open group can be locked.' });
    
    group.status = 'LOCKED';
    await group.save();
    res.json({ success: true, group, message: 'Group locked' });
  } catch (error) { next(error); }
};

const leaveGroup = async (req, res, next) => {
  try {
    const group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const memberIndex = group.members.findIndex(m => m.userId.toString() === req.user._id.toString());
    if (memberIndex === -1) return res.status(400).json({ success: false, message: 'Not a member of this group' });

    group.members[memberIndex].status = 'LEFT';

    if (group.leaderId.toString() === req.user._id.toString()) {
      const nextMember = group.members.find(m => m.status === 'JOINED' && m.userId.toString() !== req.user._id.toString());
      if (nextMember) {
        group.leaderId = nextMember.userId;
      } else {
        // Empty group, we can delete or keep it as LEFT
        // Just leave it as LEFT for now, status COMPLETED or something?
        // Actually, let's keep it simple.
      }
    }

    await group.save();
    res.json({ success: true, message: 'Left the group successfully', group });
  } catch (error) { next(error); }
};

module.exports = { createGroup, joinGroup, getGroupDetails, lockGroup, leaveGroup };
