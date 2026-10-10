const fs = require('fs');
const { execSync } = require('child_process');

// Read .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
});

// The secrets we need to set (as defined in apphosting.yaml)
const secretsToSet = [
  'GEMINI_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY'
];

let creds = null;
if (envVars['GOOGLE_APPLICATION_CREDENTIALS_JSON']) {
  try {
    // Replace literal \n with actual newline if needed, though for the secret it might be fine as is
    let credStr = envVars['GOOGLE_APPLICATION_CREDENTIALS_JSON'].replace(/\\n/g, '\n');
    creds = JSON.parse(credStr);
  } catch(e) {
    console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
  }
}

for (const secret of secretsToSet) {
  let val = envVars[secret];
  
  // Fill in missing ones from the creds JSON if possible
  if (!val && creds) {
    if (secret === 'FIREBASE_PROJECT_ID') val = creds.project_id;
    if (secret === 'FIREBASE_CLIENT_EMAIL') val = creds.client_email;
    if (secret === 'FIREBASE_PRIVATE_KEY') val = creds.private_key;
  }
  
  if (val) {
    console.log(`Setting secret: ${secret}`);
    try {
      execSync(`npx firebase-tools apphosting:secrets:set ${secret} --data-file - --force --project studio-7521332906-59af2`, {
        input: val,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    } catch (e) {
      console.error(`Failed to set ${secret}`);
    }
  } else {
    console.log(`No value found for ${secret} in .env, skipping.`);
  }
}
