
import type { RateFileType, RateData } from './types';
import { CSV_EXPECTED_HEADERS } from './types';

function arraysMatch(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false;
  const lowerArr1 = arr1.map(h => h.trim().toLowerCase());
  const lowerArr2 = arr2.map(h => h.trim().toLowerCase());
  return lowerArr1.every((value, index) => value === lowerArr2[index]);
}


function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && i + 1 < row.length && row[i+1] === '"') {
        currentCell += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentCell.trim());
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  result.push(currentCell.trim()); 
  return result;
}


export function parseCsvToRateData(
  csvString: string,
  rateType: RateFileType
): { success: boolean; data?: RateData; error?: string } {
  const lines = csvString.trim().split(/\r\n|\n/);
  if (lines.length < 2) {
    return { success: false, error: 'CSV must have at least a header and one data row.' };
  }

  const headerLine = lines[0];
  const headers = parseCsvRow(headerLine);
  const expectedHeaders = CSV_EXPECTED_HEADERS[rateType];

  if (!expectedHeaders) {
    return { success: false, error: `No expected headers defined for rate type: ${rateType}` };
  }

  if (!arraysMatch(headers, expectedHeaders)) {
    return {
      success: false,
      error: `CSV headers do not match expected headers for ${rateType}. Expected: "${expectedHeaders.join(',')}", Got: "${headers.join(',')}"`,
    };
  }

  const dataRows = lines.slice(1);
  const jsonData: any[] = []; // Use any[] initially

  for (const row of dataRows) {
    if (row.trim() === '') continue; 
    const values = parseCsvRow(row);
    if (values.length !== headers.length) {
      console.warn(`Row has incorrect number of columns: "${row}". Expected ${headers.length}, got ${values.length}. Skipping.`);
      continue; // Skip malformed rows
    }

    const entry: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      const lowerHeader = header.toLowerCase();
      
      const isNumericField = 
            !isNaN(parseFloat(value)) && // Is it a number?
            !/logic|service|from|to|lup|journey|description|reciprocal|combined|suburb|from - to|pe suburb|pe zone/i.test(header); // But not one of these specific text fields

      
      if (isNumericField) {
        const numValue = parseFloat(value);
        entry[header] = numValue; // Store as number
      } else {
        entry[header] = value; // Store as string
      }
    });
    jsonData.push(entry);
  }
  
  if(jsonData.length === 0 && dataRows.length > 0) {
      return { success: false, error: 'All data rows were malformed or empty. Please check the file content.' };
  }
  
  return { success: true, data: jsonData as RateData };
}

    