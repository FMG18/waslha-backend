const TRIP_STATUSES = Object.freeze([
  'DRAFT',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]);

const PAYMENT_METHODS = Object.freeze(['CASH', 'CARD', 'WALLET']);
const NOTIFICATION_TYPES = Object.freeze(['TRIP', 'PAYMENT', 'PROMOTION', 'SECURITY', 'SYSTEM']);
const SUPPORT_STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) {
    const error = new Error(`Invalid ${name}`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return value;
}

function normalizePaymentMethod(input) {
  return {
    type: assertEnum(String(input?.type || 'CASH').toUpperCase(), PAYMENT_METHODS, 'payment method'),
    label: String(input?.label || 'الدفع نقداً').trim().slice(0, 80),
    maskedNumber: input?.maskedNumber ? String(input.maskedNumber).slice(0, 32) : null,
    isDefault: Boolean(input?.isDefault)
  };
}

function normalizeTripStatus(status) {
  return assertEnum(String(status).toUpperCase(), TRIP_STATUSES, 'trip status');
}

function normalizeNotification(input) {
  return {
    id: String(input?.id || '').trim(),
    title: String(input?.title || '').trim().slice(0, 120),
    body: String(input?.body || '').trim().slice(0, 500),
    type: assertEnum(String(input?.type || 'SYSTEM').toUpperCase(), NOTIFICATION_TYPES, 'notification type'),
    read: Boolean(input?.read),
    createdAt: input?.createdAt ? new Date(input.createdAt) : new Date()
  };
}

function normalizeSupportTicket(input) {
  return {
    id: String(input?.id || '').trim(),
    subject: String(input?.subject || '').trim().slice(0, 120),
    message: String(input?.message || '').trim().slice(0, 2000),
    status: assertEnum(String(input?.status || 'OPEN').toUpperCase(), SUPPORT_STATUSES, 'support status'),
    createdAt: input?.createdAt ? new Date(input.createdAt) : new Date()
  };
}

module.exports = {
  TRIP_STATUSES,
  PAYMENT_METHODS,
  NOTIFICATION_TYPES,
  SUPPORT_STATUSES,
  assertEnum,
  normalizePaymentMethod,
  normalizeTripStatus,
  normalizeNotification,
  normalizeSupportTicket
};
