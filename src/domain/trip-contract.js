export const TRIP_STATUSES = Object.freeze([
  'searching',
  'driver_assigned',
  'arriving',
  'in_progress',
  'completed',
  'cancelled'
]);

export const VEHICLE_TYPES = Object.freeze([
  'economy',
  'comfort',
  'family'
]);

export const PAYMENT_METHODS = Object.freeze([
  'cash',
  'card',
  'wallet'
]);

const invalid = (message) => {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  error.statusCode = 400;
  return error;
};

export function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw invalid(`قيمة ${name} غير صالحة`);
  return value;
}

export function normalizeCoordinate(point, name) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw invalid(`${name} غير صالح`);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw invalid(`${name} خارج النطاق`);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export function normalizeTripRequest(input = {}) {
  const customerId = String(input.customerId ?? '').trim();
  if (!customerId) throw invalid('معرّف الزبون مطلوب');
  if (customerId.length > 120) throw invalid('معرّف الزبون طويل جداً');

  const pickup = normalizeCoordinate(input.pickup, 'موقع الانطلاق');
  const destination = normalizeCoordinate(input.destination, 'الوجهة');
  const vehicleType = assertEnum(String(input.vehicleType || 'economy').toLowerCase(), VEHICLE_TYPES, 'نوع السيارة');
  const paymentMethod = assertEnum(String(input.paymentMethod || 'cash').toLowerCase(), PAYMENT_METHODS, 'طريقة الدفع');

  let scheduledAt = null;
  if (input.scheduledAt != null && String(input.scheduledAt).trim() !== '') {
    const parsed = new Date(input.scheduledAt);
    if (Number.isNaN(parsed.getTime())) throw invalid('موعد الرحلة غير صالح');
    if (parsed.getTime() < Date.now() - 60_000) throw invalid('موعد الرحلة يجب أن يكون في المستقبل');
    scheduledAt = parsed.toISOString();
  }

  return {
    customerId,
    pickup,
    destination,
    vehicleType,
    paymentMethod,
    scheduledAt
  };
}

export function buildStatusEvent(status, actor = 'system', metadata = null) {
  return {
    status,
    actor: String(actor || 'system').slice(0, 80),
    at: Date.now(),
    metadata: metadata && typeof metadata === 'object' ? metadata : null
  };
}
