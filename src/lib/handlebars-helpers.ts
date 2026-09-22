
'use server';

// Robust Handlebars helper registration to cover common runtime instances.
// Import this module as early as possible (before any templates are compiled/evaluated).

function tryRegisterOn(hb: any) {
  if (!hb) return false;
  try {
    if (typeof hb.registerHelper === 'function' && !(hb as any).__helpers_registered) {
      hb.registerHelper('eq', (a: any, b: any) => a === b);
      (hb as any).__helpers_registered = true;
      console.log(`Handlebars helper 'eq' registered on instance version: ${hb.VERSION}`);
      return true;
    }
  } catch (e) {
    // Ignore, this instance may not be a valid Handlebars object.
  }
  return false;
}

let registered = false;

// Try to get Handlebars from require if in a CJS environment.
try {
  const handlebars = require('handlebars');
  if (tryRegisterOn(handlebars)) registered = true;
} catch (e) {
  // Not in a CJS environment or 'handlebars' not found, which is fine.
}

// Also try to patch the runtime if it's separate.
try {
  const handlebarsRuntime = require('handlebars/runtime');
  if (tryRegisterOn(handlebarsRuntime)) registered = true;
} catch (e) {
  // Runtime may not be a separate module, which is also fine.
}

// Check for global Handlebars instance, common in some client-side setups.
if (typeof globalThis !== 'undefined' && (globalThis as any).Handlebars) {
  if (tryRegisterOn((globalThis as any).Handlebars)) registered = true;
}

if (!registered) {
  console.warn("Could not find a Handlebars instance to register the 'eq' helper.");
}
