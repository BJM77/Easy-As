/**
 * Vitest tests for freight calculation functions
 */

import { describe, it, expect } from 'vitest';
import { calculateChargeableWeight } from './freightCalculations';
import type { FreightItem } from '@/lib/types';

describe('Freight Calculations', () => {
  // Test: Calculate chargeable weight with cubic discount
  it('should apply cubic discount when dead weight is less than 50% of cubic weight', () => {
    const items: FreightItem[] = [{ 
      weight: 5, 
      length: 100, 
      width: 80, 
      height: 60, 
      quantity: 1 
    }];
    
    // Dead weight: 5kg * 1 = 5kg
    // Cubic volume: (1) * (0.8) * (0.8) * (0.6) * 1 = 0.384m³
    // Cubic weight: 0.384 * 250 = 96kg
    
    const result = calculateChargeableWeight(items, 250, false);
    
    expect(result).toBeGreaterThan(5); // Should use cubic weight
    expect(result).toBeLessThanOrEqual(96); // Cubic weight is 96kg
  });

  // Test: Calculate chargeable weight with no cubic (dead weight only)
  it('should use dead weight when globalNoCubic is true', () => {
    const items: FreightItem[] = [{ weight: 10, length: 100, width: 80, height: 60, quantity: 1 }];
    
    // Dead weight: 10kg * 1 = 10kg
    
    const result = calculateChargeableWeight(items, 250, true);
    
    expect(result).toBe(10); // Should use dead weight only
  });

  // Test: Empty items array returns 0
  it('should return 0 for empty items array', () => {
    const items: FreightItem[] = [];
    
    const result = calculateChargeableWeight(items, 250, false);
    
    expect(result).toBe(0);
  });

  // Test: Single pallet item
  it('should correctly calculate weight for a single pallet', () => {
    const items: FreightItem[] = [{ 
      weight: 500, 
      length: 120, 
      width: 80, 
      height: 60, 
      quantity: 1 
    }];
    
    // Dead weight: 500kg
    // Cubic volume: (1.2) * (0.8) * (0.6) = 0.576m³
    // Cubic weight: 0.576 * 250 = 144kg
    
    const result = calculateChargeableWeight(items, 250, false);
    
    expect(result).toBe(500); // Dead weight wins since it's greater than cubic
  });

  // Test: Multiple items with mixed weights
  it('should correctly calculate total weight for multiple items', () => {
    const items: FreightItem[] = [
      { weight: 10, length: 80, width: 60, height: 50, quantity: 2 },
      { weight: 5, length: 100, width: 80, height: 60, quantity: 1 }
    ];
    
    const result = calculateChargeableWeight(items, 250, true);
    
    // Expected: (10*2) + (5*1) = 25kg dead weight
    expect(result).toBe(25);
  });
});
