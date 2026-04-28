const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function testAuth() {
    try {
        console.log('Testing Admin Auth access...');
        // Try to list 1 user to verify permissions
        const listUsersResult = await admin.auth().listUsers(1);
        console.log('✅ Success! Admin SDK has permission to access Auth/Identity Toolkit.');
    } catch (error) {
        console.error('❌ Error! Admin SDK does not have sufficient permissions.');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        
        if (error.message.includes('Identity Toolkit API')) {
            console.log('\n👉 SOLUTION: Go to the Google Cloud Console and ENABLE the "Identity Toolkit API".');
        } else if (error.code === 'auth/insufficient-permission' || error.message.includes('insufficient permission')) {
            console.log('\n👉 SOLUTION: Ensure the Service Account has the "Firebase Admin" role in IAM.');
        }
    } finally {
        process.exit(0);
    }
}

testAuth();
