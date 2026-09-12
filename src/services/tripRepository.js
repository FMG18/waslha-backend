import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';
import { buildStatusEvent } from '../domain/trip-contract.js';

const memory = new Map();
const collection = () => getDatabase()?.collection('trips');

export async function createTrip(data) {
  const now = Date.now();
  const initialStatus = data.status || 'searching';
  const trip = {
    id: `W-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
    statusHistory: data.statusHistory?.length
      ? data.statusHistory
      : [buildStatusEvent(initialStatus, 'system')],
    ...data
  };
  const c = collection();
  if (c) await c.insertOne({ ...trip, _id: trip.id }); else memory.set(trip.id, trip);
  return trip;
}

export async function getTrip(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;
  const c = collection();
  if (c) {
    const byId = await c.findOne({ _id: normalizedId });
    if (byId) return byId;
    return c.findOne({ id: normalizedId });
  }
  return memory.get(normalizedId) || null;
}

export async function listTrips(customerId) {
  const c = collection();
  if (c) return c.find(customerId ? { customerId } : {}).sort({ createdAt: -1 }).limit(100).toArray();
  return [...memory.values()]
    .filter((t) => !customerId || t.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100);
}

export async function updateTrip(id, patch, options = {}) {
  const now = Date.now();
  const current = await getTrip(id);
  if (!current) return null;

  const updated = {
    ...patch,
    updatedAt: now
  };

  if (patch.status && patch.status !== current.status) {
    updated.statusChangedAt = patch.statusChangedAt || now;
    updated.statusHistory = [
      ...(current.statusHistory || []),
      buildStatusEvent(patch.status, options.actor || patch.statusActor || 'system', options.metadata || null)
    ];
  }

  const c = collection();
  if (c) {
    await c.updateOne({ _id: current._id }, { $set: updated });
    return getTrip(id);
  }

  const trip = memory.get(String(id));
  if (!trip) return null;
  Object.assign(trip, updated);
  return trip;
}
