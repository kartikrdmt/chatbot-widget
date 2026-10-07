// One-off, idempotent: moves an older database to tenant-scoped collections. Run with --dry first.
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';

try {
  process.loadEnvFile('.env');
} catch {}

const dry = process.argv.includes('--dry');
const DEMO_TENANT = process.env.DEFAULT_TENANT_ID ?? 'demo-tenant';

await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/chatbot');
const db = mongoose.connection.db;
const col = (name) => db.collection(name);
const report = {};
const bump = (key, n) => (report[key] = (report[key] ?? 0) + n);

const idMap = new Map();
for (const tenant of await col('tenants').find({}).toArray()) {
  const tenantId = tenant.tenantId ?? (tenant.name === 'Demo' ? DEMO_TENANT : `t_${tenant._id}`);
  idMap.set(String(tenant._id), tenantId);
  if (tenant.tenantId) continue;
  if (await col('tenants').findOne({ tenantId, _id: { $ne: tenant._id } })) {
    bump('legacy tenants merged into an existing record', 1);
    if (!dry) await col('tenants').deleteOne({ _id: tenant._id });
    continue;
  }
  bump('tenants updated', 1);
  if (!dry) {
    await col('tenants').updateOne(
      { _id: tenant._id },
      { $set: { tenantId, plan: tenant.plan ?? 'free', monthlyMessageLimit: tenant.monthlyMessageLimit ?? 1000, status: tenant.status ?? 'active' } },
    );
  }
}

for (const name of ['sites', 'visitors', 'conversations']) {
  for (const doc of await col(name).find({ tenantId: { $type: 'objectId' } }).toArray()) {
    const tenantId = idMap.get(String(doc.tenantId)) ?? DEMO_TENANT;
    bump(`${name} updated`, 1);
    if (!dry) await col(name).updateOne({ _id: doc._id }, { $set: { tenantId } });
  }
}

const conversations = new Map(
  (await col('conversations').find({}).toArray()).map((c) => [String(c._id), c]),
);
for (const message of await col('messages').find({ $or: [{ tenantId: { $exists: false } }, { siteId: { $exists: false } }] }).toArray()) {
  const conversation = conversations.get(String(message.conversationId));
  if (!conversation) {
    bump('messages with no conversation (left alone)', 1);
    continue;
  }
  const tenantId = typeof conversation.tenantId === 'string' ? conversation.tenantId : (idMap.get(String(conversation.tenantId)) ?? DEMO_TENANT);
  bump('messages updated', 1);
  if (!dry) await col('messages').updateOne({ _id: message._id }, { $set: { tenantId, siteId: conversation.siteId } });
}

console.log(dry ? '[dry run] would change:' : 'changed:', Object.keys(report).length ? report : 'nothing (already migrated)');
await mongoose.disconnect();
