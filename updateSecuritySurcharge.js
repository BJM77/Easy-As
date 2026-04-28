const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateSecuritySurcharge() {
    try {
        const settingsRef = db.collection('settings').doc('global');
        
        console.log('Reading current settings...');
        const doc = await settingsRef.get();
        
        if (!doc.exists) {
            console.log('Global settings doc does not exist, creating with defaults...');
            await settingsRef.set({
                globalSecuritySurchargePercent: 8.49,
                updatedAt: new Date().toISOString(),
                updatedBy: 'system-fix'
            });
        } else {
            console.log('Updating global security surcharge to 8.49%...');
            await settingsRef.update({
                globalSecuritySurchargePercent: 8.49,
                updatedAt: new Date().toISOString(),
                updatedBy: 'system-fix'
            });
        }
        
        console.log('✅ Successfully updated security surcharge to 8.49% in Firestore.');
    } catch (error) {
        console.error('❌ Error updating Firestore:', error.message);
    } finally {
        process.exit(0);
    }
}

updateSecuritySurcharge();
