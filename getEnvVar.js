const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccount.json', 'utf8'));
console.log("GOOGLE_APPLICATION_CREDENTIALS_JSON='" + JSON.stringify(serviceAccount) + "'");
