// Helper script to output the service account as a clean one-line JSON string for .env file
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');

try {
    const rawContent = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(rawContent);

    // Output as a single-line COMPACT JSON string
    // This removes all newlines and extra spaces, which prevents common copy-paste syntax errors
    const compactJsonString = JSON.stringify(serviceAccount);

    console.log('\n✅ COMPACT JSON GENERATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. COPY THE ENTIRE LINE BELOW (between the stars):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('*' + compactJsonString + '*');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2. IN YOUR HOSTING PROVIDER (e.g., Firebase App Hosting):');
    console.log('   - Find the secret named GOOGLE_APPLICATION_CREDENTIALS_JSON');
    console.log('   - Delete the old value.');
    console.log('   - Paste the NEW string exactly as shown above (excluding the stars).');
    console.log('   - Save and trigger a new deployment.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('💡 Why this works: Environment variables often choke on literal newlines found in JSON files.');
    console.log('The string above is "flattened" into one single line, which is much more stable.\n');

} catch (e) {
    console.error("❌ Error: Could not find or read 'serviceAccount.json' in the root directory.");
    console.log("Please ensure you have generated your service account key and named it 'serviceAccount.json'.");
    console.log("You can get this from: Firebase Console > Project Settings > Service Accounts > Generate new private key.\n");
}
