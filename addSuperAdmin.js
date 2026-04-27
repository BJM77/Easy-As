// Script to find UID by email and display it
// Usage: node addSuperAdmin.js benjamin.mackie@teamglobalexp.com

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const email = process.argv[2];

if (!email) {
    console.error('Please provide an email address as argument');
    console.log('Usage: node addSuperAdmin.js <email>');
    process.exit(1);
}

async function findAndDisplayUID() {
    try {
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log('\n✅ User found!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email: ${userRecord.email}`);
        console.log(`UID: ${userRecord.uid}`);
        console.log(`Display Name: ${userRecord.displayName || 'N/A'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('📋 To make this user a superadmin, add this UID to the following files:\n');
        console.log('1. src/firebase/auth/use-user.tsx');
        console.log('   Line 20-23: SUPERADMIN_UIDS array\n');
        console.log('2. src/firebase/serverApp.ts');
        console.log('   Line 100: SUPERADMIN_UIDS array\n');
        console.log('3. src/firestore.rules');
        console.log('   Line 24: isSuperAdmin() function\n');

        console.log(`Add this line to each array:`);
        console.log(`  '${userRecord.uid}', // ${email}\n`);

    } catch (error) {
        console.error('❌ Error finding user:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

findAndDisplayUID();
