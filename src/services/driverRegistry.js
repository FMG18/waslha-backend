import { getDatabase } from '../db/mongo.js';
import { sortByDistance } from './geo.js';

const memory = new Map();

const collection = () => getDatabase()?.collection('drivers');

const clone = (driver) => driver ? { ...driver } : null;

const normalize = (driver) => {
  if (!driver) return null;
  return {
    id: String(driver.id || driver._id),
    name: String(driver.name || ''),
    phone: driver.phone || null,
    rating: Number.isFinite(Number(driver.rating)) ? Number(driver.rating) : 0,
    vehicle: String(driver.vehicle || ''),
    plate: String(driver.plate || ''),
    type: String(driver.type || driver.vehicleType || 'economy'),
    lat: Number.isFinite(Number(driver.lat)) ? Number(driver.lat) : null,
    lng: Number.isFinite(Number(driver.lng)) ? Number(driver.lng) : null,
    available: Boolean(driver.available),
    lastLocationAt: driver.lastLocationAt || null,
    updatedAt: driver.updatedAt || Date.now(),
    createdAt: driver.createdAt || Date.now()
  };
};

async function userForDriver(id) {
  const db = getDatabase();
  if (!db) return null;
  return db.collection('users').findOne(
    { $or: [{ id: String(id) }, { _id: String(id) }] },
    { projection: { _id: 1, id: 1, name: 1, phone: 1, role: 1 } }
  );
}

export async function ensureDriver(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const c = collection();
  if (c) {
    const existing = await c.findOne({ id: normalizedId });
    if (existing) return normalize(existing);

    const user = await userForDriver(normalizedId);
    if (!user || user.role !== 'driver') return null;

    const now = Date.now();
    const driver = normalize({
      id: String(user.id || user._id),
      name: user.name || '',
      phone: user.phone || null,
      rating: 0,
      vehicle: '',
      plate: '',
      type: 'economy',
      lat: null,
      lng: null,
      available: false,
      lastLocationAt: null,
      createdAt: now,
      updatedAt: now
    });

    await c.updateOne(
      { id: driver.id },
      { $setOnInsert: { ...driver, _id: driver.id } },
      { upsert: true }
    );
    return normalize(await c.findOne({ id: driver.id }));
  }

  return clone(normalize(memory.get(normalizedId)));
}

export async function listDrivers({ vehicleType = null, includeOffline = true } = {}) {
  const type = vehicleType ? String(vehicleType).toLowerCase() : null;
  const c = collection();

  if (c) {
    const filter = {};
    if (type) filter.type = type;
    if (!includeOffline) filter.available = true;
    const docs = await c.find(filter).sort({ updatedAt: -1 }).limit(500).toArray();
    return docs.map(normalize).map(clone);
  }

  return [...memory.values()]
    .map(normalize)
    .filter((driver) => (!type || driver.type === type) && (includeOffline || driver.available))
    .map(clone);
}

export async function getDriver(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const c = collection();
  if (c) {
    const existing = await c.findOne({ id: normalizedId });
    if (existing) return normalize(existing);
    return ensureDriver(normalizedId);
  }

  return clone(normalize(memory.get(normalizedId)));
}

async function writeDriver(id, patch) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const now = Date.now();
  const c = collection();

  if (c) {
    const current = await c.findOne({ id: normalizedId });
    if (!current) return null;
    await c.updateOne({ id: normalizedId }, { $set: { ...patch, updatedAt: now } });
    return normalize(await c.findOne({ id: normalizedId }));
  }

  const current = memory.get(normalizedId);
  if (!current) return null;
  const updated = { ...current, ...patch, updatedAt: now };
  memory.set(normalizedId, updated);
  return clone(normalize(updated));
}

export async function setDriverAvailability(id, available) {
  const driver = await ensureDriver(id);
  if (!driver) return null;
  return writeDriver(driver.id, { available: Boolean(available) });
}

export async function updateDriverLocation(id, lat, lng) {
  const driver = await ensureDriver(id);
  if (!driver) return null;
  return writeDriver(driver.id, {
    lat: Number(lat),
    lng: Number(lng),
    lastLocationAt: Date.now()
  });
}

export async function reserveDriver(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const c = collection();
  if (c) {
    const result = await c.updateOne(
      { id: normalizedId, available: true },
      { $set: { available: false, updatedAt: Date.now() } }
    );
    if (!result.matchedCount) return null;
    return getDriver(normalizedId);
  }

  const driver = memory.get(normalizedId);
  if (!driver || !driver.available) return null;
  driver.available = false;
  driver.updatedAt = Date.now();
  return clone(normalize(driver));
}

export async function releaseDriver(id) {
  const driver = await ensureDriver(id);
  if (!driver) return null;
  return writeDriver(driver.id, { available: true });
}

export async function upsertDriverProfile(id, patch = {}) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const c = collection();
  const now = Date.now();

  if (c) {
    const user = await userForDriver(normalizedId);
    const existing = await c.findOne({ id: normalizedId });
    const driver = normalize({
      ...(existing || {}),
      id: normalizedId,
      name: patch.name ?? existing?.name ?? user?.name ?? '',
      phone: patch.phone ?? existing?.phone ?? user?.phone ?? null,
      rating: patch.rating ?? existing?.rating ?? 0,
      vehicle: patch.vehicle ?? existing?.vehicle ?? '',
      plate: patch.plate ?? existing?.plate ?? '',
      type: patch.type ?? existing?.type ?? patch.vehicleType ?? 'economy',
      lat: patch.lat ?? existing?.lat ?? null,
      lng: patch.lng ?? existing?.lng ?? null,
      available: patch.available ?? existing?.available ?? false,
      lastLocationAt: patch.lastLocationAt ?? existing?.lastLocationAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    await c.updateOne({ id: normalizedId }, { $set: { ...driver, _id: normalizedId }, $setOnInsert: { createdAt: driver.createdAt } }, { upsert: true });
    return normalize(await c.findOne({ id: normalizedId }));
  }

  const current = memory.get(normalizedId);
  const next = normalize({
    ...(current || {}),
    id: normalizedId,
    ...patch,
    updatedAt: now,
    createdAt: current?.createdAt || now
  });
  memory.set(normalizedId, next);
  return clone(next);
}

export async function getNearestAvailableDriver(point, vehicleType = null) {
  const eligible = await listDrivers({ vehicleType, includeOffline: false });
  if (!eligible.length) return null;
  return clone(sortByDistance(point, eligible)[0] || null);
}
