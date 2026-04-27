import { z } from 'zod';
import { ALL_USER_ROLES } from './types';

/**
 * @fileOverview Centralized Golden Record schemas for core data entities.
 * These schemas are strictly enforced in API routes and Firebase Admin operations.
 */

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  role: z.enum(ALL_USER_ROLES as [string, ...string[]]),
  companyId: z.string().min(1, "Company assignment is required"),
  assignedCompanyIds: z.array(z.string()).optional().default([]),
  subscriptionStatus: z.enum(['active', 'inactive', 'past_due']).default('active'),
  tokens: z.number().int().min(0).default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Legal name is required"),
  domain: z.string().optional().default(""),
  subscriptionStatus: z.enum(['active', 'inactive', 'past_due']).default('active'),
  settings: z.object({
    logoText: z.string().optional(),
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#4285F4'),
    accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#FFC107'),
    markup: z.number().min(0).default(0),
  }),
  enabledFeatures: z.record(z.boolean()).optional().default({}),
  isUnlimited: z.boolean().optional().default(false),
  promoExpiryDate: z.string().datetime().optional(),
  createdAt: z.string().optional(),
});

export type UserProfileEntity = z.infer<typeof userProfileSchema>;
export type CompanyEntity = z.infer<typeof companySchema>;
