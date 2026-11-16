const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const models = [
  'User', 'Order', 'Product', 'Category', 'Payment', 'Notification', 'WebhookEvent', 'Coupon',
  'PickupSlot', 'RestaurantSettings', 'OtpChallenge', 'EmailOtpChallenge', 'Table', 'GroupOrder', 'Issue',
].map(name => require(`../models/${name}`));

const sameIndex = (actual, expectedKeys, expectedOptions) => {
  if (JSON.stringify(actual.key) !== JSON.stringify(expectedKeys)) return false;
  for (const option of ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression']) {
    if (expectedOptions[option] !== undefined && JSON.stringify(actual[option]) !== JSON.stringify(expectedOptions[option])) return false;
    if (expectedOptions[option] === undefined && actual[option] !== undefined && actual[option] !== false) return false;
  }
  return true;
};

const checkDatabase = async () => {
  try {
    console.log('[Database Check] Connecting to the configured MongoDB database…');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wrapchik', { serverSelectionTimeoutMS: 5000 });
    console.log(`[Database Check] Connected to host ${mongoose.connection.host}; database ${mongoose.connection.name}.`);

    const results = await Promise.all(models.map(async Model => {
      const [documentCount, hasCollection] = await Promise.all([
        Model.countDocuments(),
        mongoose.connection.db.listCollections({ name: Model.collection.collectionName }, { nameOnly: true }).hasNext(),
      ]);
      const actualIndexes = hasCollection ? await Model.collection.indexes() : [];
      const expectedIndexes = Model.schema.indexes().map(([keys, options]) => ({
        keys,
        name: options.name || Object.entries(keys).map(([key, direction]) => `${key}_${direction}`).join('_'),
        verified: actualIndexes.some(index => sameIndex(index, keys, options)),
      }));
      return {
        collection: Model.collection.collectionName,
        documents: documentCount,
        indexes: actualIndexes.map(index => ({ name: index.name, keys: index.key, unique: Boolean(index.unique), sparse: Boolean(index.sparse), expireAfterSeconds: index.expireAfterSeconds })),
        expectedIndexes,
        missingExpectedIndexes: expectedIndexes.filter(index => !index.verified).map(index => index.name),
      };
    }));

    console.log(JSON.stringify({ success: true, collections: results }, null, 2));
    const missing = results.flatMap(result => result.missingExpectedIndexes.map(name => `${result.collection}.${name}`));
    if (missing.length) {
      console.error(`[Database Check] Expected indexes are missing: ${missing.join(', ')}`);
      process.exitCode = 2;
    } else {
      console.log('[Database Check] All declared model indexes are present. No records were modified or printed.');
    }
  } catch (error) {
    console.error(`[Database Check] Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

checkDatabase();
