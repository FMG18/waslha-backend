import { z } from 'zod';

export const phoneSchema = z.object({ phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/) });
export const verifyCodeSchema = phoneSchema.extend({ code: z.string().regex(/^\d{6}$/) });

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().trim().max(200).optional(),
  distanceKm: z.number().min(0).max(200).optional()
});

export const tripCreateSchema = z.object({
  pickup: pointSchema,
  destination: pointSchema,
  vehicleType: z.enum(['economy', 'comfort', 'family']).default('economy'),
  paymentMethod: z.enum(['cash', 'wallet']).default('cash')
});

export const statusSchema = z.object({ status: z.enum(['searching', 'driver_assigned', 'arriving', 'in_progress', 'completed', 'cancelled']) });
export const ratingSchema = z.object({ tripId: z.string().min(2), driverId: z.string().min(2), score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });
