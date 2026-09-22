
// Improved address extraction utilities.
// - Preserves country code if present (e.g. "AU").
// - Infers Australian state from postcode when state is not explicitly present.
// - Attempts to extract street + suburb + postcode, falling back to cleaned text.

const stateAbbreviations = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const streetTypes = ["Street","St","Road","Rd","Avenue","Ave","Drive","Dr","Court","Ct","Crescent","Cres","Place","Pl","Grove","Lane","Ln","Terrace","Tce","Way","Walk","Boulevard","Bvd","Parade","Pde"];
const streetTypesPattern = streetTypes.join('|');

function removeLogisticTokens(text: string): string {
  return text
    .replace(/\++/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,}\b/g, ' ')
    .replace(/\b[A-Z0-9]{5,}\b/g, ' ')
    .replace(/\b[SNY]{1,2}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function inferStateFromPostcode(postcode: string): string {
    const firstDigit = postcode.charAt(0);
    switch(firstDigit) {
        case '2': return 'NSW';
        case '3': return 'VIC';
        case '4': return 'QLD';
        case '5': return 'SA';
        case '6': return 'WA';
        case '7': return 'TAS';
        case '0': return 'NT';
        default: return '';
    }
}

export function extractAddress(data: string): string {
    if (!data) return '';
    let s = data.replace(/\r?\n/g, ' ').replace(/[|><\*]/g, ' ').replace(/\s+/g, ' ').trim();

    const postcodeRegex = /\b(\d{4})\b/g;
    const candidates: { code: string; index: number }[] = [];
    let m;
    while ((m = postcodeRegex.exec(s)) !== null) {
        candidates.push({ code: m[1], index: m.index });
    }

    if (candidates.length > 0) {
        const best = candidates[candidates.length - 1]; // Assume last postcode is most relevant
        const countryMatch = s.substring(best.index).match(/\b(AU|NZ|USA)\b/i);
        const country = countryMatch ? ` ${countryMatch[0].toUpperCase()}` : '';

        const start = Math.max(0, best.index - 200);
        let window = s.substring(start, best.index + 4);
        window = removeLogisticTokens(window);

        const streetRegex = new RegExp(`(\\d{1,4}[A-Za-z]?\\/?\\d{0,4}\\s+[A-Za-z0-9'\\- ]+\\s+(?:${streetTypesPattern}))`, 'i');
        const streetMatch = window.match(streetRegex);
        
        let addressPart: string;
        if (streetMatch && streetMatch[1]) {
            addressPart = streetMatch[1];
        } else {
            // Fallback: Grab a few words before the postcode
            const prePostcode = window.substring(0, window.lastIndexOf(best.code)).trim();
            const words = prePostcode.split(/\s+/);
            addressPart = words.slice(-4).join(' '); // Take last 4 words as likely address
        }

        let state = '';
        const stateRegex = new RegExp(`\\b(${stateAbbreviations.join('|')})\\b`, 'i');
        const stateMatch = s.match(stateRegex);
        if (stateMatch) {
            state = stateMatch[0].toUpperCase();
        } else {
            state = inferStateFromPostcode(best.code);
        }

        // Reconstruct the address
        let finalAddress = addressPart.replace(/ ,/g, ',');
        if (!finalAddress.toLowerCase().includes(best.code)) {
            finalAddress += `, ${best.code}`;
        }
        if (state && !finalAddress.toLowerCase().includes(state.toLowerCase())) {
            finalAddress += ` ${state}`;
        }
        finalAddress += country;

        return finalAddress.replace(/\s+/g, ' ').trim();
    }
    
    // Fallback if no postcode is found
    return removeLogisticTokens(s).split(/\s+/).slice(0, 10).join(' ');
}
