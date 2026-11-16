require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const strongPassword = (password) =>
  typeof password === 'string' && /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/.test(password);

const ask = (prompt) => new Promise((resolve) => {
  const interfaceHandle = readline.createInterface({ input: process.stdin, output: process.stdout });
  interfaceHandle.question(prompt, (answer) => {
    interfaceHandle.close();
    resolve(answer.trim());
  });
});

const askSecret = (prompt) => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    reject(new Error('Run this command in an interactive PowerShell terminal so password input can stay hidden.'));
    return;
  }

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(prompt);
  let value = '';

  const restore = () => {
    input.removeListener('keypress', onKeypress);
    input.setRawMode(false);
    process.stdout.write('\n');
  };

  const onKeypress = (character, key = {}) => {
    if (key.ctrl && key.name === 'c') {
      restore();
      reject(new Error('Recovery cancelled.'));
      return;
    }
    if (key.name === 'return' || key.name === 'enter') {
      restore();
      resolve(value);
      return;
    }
    if (key.name === 'backspace') {
      value = value.slice(0, -1);
      return;
    }
    if (character && !key.ctrl && value.length < 128) value += character;
  };

  input.on('keypress', onKeypress);
});

const isLocalMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return parsed.protocol === 'mongodb:' && ['localhost', '127.0.0.1', '::1'].includes(host);
  } catch (error) {
    return false;
  }
};

const run = async () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Admin recovery is restricted to NODE_ENV=development.');
  }
  if (!process.env.MONGO_URI || !isLocalMongoUri(process.env.MONGO_URI)) {
    throw new Error('Admin recovery only runs against a local mongodb://localhost, 127.0.0.1, or ::1 database.');
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const admins = await User.find({ role: 'admin' }).select('email role').sort({ email: 1 }).lean();
  if (!admins.length) {
    throw new Error('No administrator accounts exist in this local database. This utility never creates or promotes accounts.');
  }
  console.log('Existing administrator account emails:');
  admins.forEach((admin) => console.log(`- ${admin.email}`));

  const email = (await ask('Administrator email to recover: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  const user = await User.findOne({ email, role: 'admin' }).select('_id email role');
  if (!user) {
    throw new Error('That email is not an existing administrator account. No account was changed.');
  }

  console.log(`Target: existing administrator ${email}`);
  if ((await ask('Type the email exactly to confirm this target: ')).toLowerCase() !== email) {
    throw new Error('Confirmation did not match; no account was changed.');
  }

  const password = await askSecret('New administrator password (hidden, 12+ characters with letters and numbers): ');
  if (!strongPassword(password)) {
    throw new Error('Password must be 12–128 characters and include at least one letter and one number. No account was changed.');
  }
  const confirmation = await askSecret('Confirm new password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match. No account was changed.');

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await User.findOneAndUpdate(
    { _id: user._id, role: 'admin' },
    { $set: { passwordHash } },
    { new: true, runValidators: true, select: 'email role' }
  );
  if (!updated) throw new Error('The administrator record changed during recovery. No password was written.');

  console.log(`Administrator password reset for ${updated.email}.`);
  console.log('The password was neither displayed nor logged.');
};

run()
  .catch((error) => {
    console.error(`[Admin recovery] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
