// Script to list all users and find UID by email
// Usage: node findUserUID.js benjamin.mackie@teamglobalexp.com

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'tgebdtools'
});

const db = admin.firestore();
const searchEmail = process.argv[2];

if (!searchEmail) {
    console.error('Please provide an email address as argument');
    console.log('Usage: node findUserUID.js <email>');
    process.exit(1);
}

async function findUserInFirestore() {
    try {
        console.log(`\n🔍 Searching for user with email: ${searchEmail}\n`);

        // Query Firestore users collection
        const usersSnapshot = await db.collection('users').get();

        let found = false;
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.email && userData.email.toLowerCase() === searchEmail.toLowerCase()) {
                found = true;
                console.log('✅ User found in Firestore!');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`UID: ${doc.id}`);
                console.log(`Email: ${userData.email}`);
                console.log(`Name: ${userData.name || 'N/A'}`);
                console.log(`Current Role: ${userData.role || 'N/A'}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                console.log('📋 To make this user a superadmin, add this UID to:\n');
                console.log('1. src/firebase/auth/use-user.tsx (line 20-23)');
                console.log('2. src/firebase/serverApp.ts (line 100)');
                console.log('3. src/firestore.rules (line 24)\n');
                console.log(`Add this line to each SUPERADMIN_UIDS array:`);
                console.log(`  '${doc.id}', // ${userData.email}\n`);
            }
        });

        if (!found) {
            console.log('❌ User not found in Firestore.');
            console.log('The user may need to sign in first to create their profile.\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

findUserInFirestore();
