
import { calculateOptimizedRates } from '../src/lib/freightCalculations';

// Mock data
const mockOptions = {
    formData: {
        items: [{ weight: 15, quantity: 1 }],
        selectedServices: ['B2C Std', 'LCP GO Std'],
        spendBand: '1',
        originLocation: { prio: 'SYD', ipec: 'SYD' },
        destinationLocation: { prio: 'MEL', ipec: 'MEL' },
    },
    allServiceSettings: [
        { id: 'B2C Std', fuelSurchargePercent: 10, surcharges: [] },
        { id: 'LCP GO Std', fuelSurchargePercent: 10, surcharges: [] }
    ],
    allSurchargeDefinitions: [],
    getRateFile: (type) => {
        if (type === 'lcpgo') return [{ Logic: 'GoOff PeakSYDMEL', Go10: 10, Go5: 6 }];
        if (type === 'b2c') return [{ Logic: '1SYDMEL', b2c5: 5, b2c1: 2 }];
        return [];
    }
};

async function test() {
    console.log("Testing IntelliSend Combination Logic...");
    const result = await calculateOptimizedRates(mockOptions as any);
    console.log("Combination Text:", result.combinationText);
    console.log("LCP GO Price:", result.lcpGoStdPrice);
    console.log("B2C Price:", result.b2cStdPrice);
}

test();
