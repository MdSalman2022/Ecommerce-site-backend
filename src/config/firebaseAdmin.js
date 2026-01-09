/**
 * Firebase Admin SDK Configuration
 * Used for sending push notifications via FCM
 */
const admin = require('firebase-admin');
// var admin = require("firebase-admin");

// var serviceAccount = require("path/to/serviceAccountKey.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://bestdeal-ecommerce-default-rtdb.asia-southeast1.firebasedatabase.app"
// });

let firebaseApp = null;

const initializeFirebase = () => {
    if (firebaseApp) return firebaseApp;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            console.warn('Firebase credentials not configured. Push notifications disabled.');
            return null;
        }

        console.log('[Firebase] Initializing with Project ID:', projectId);

        // Robust Private Key Sanitization
        console.log('[Firebase] Raw key length:', privateKey.length);

        // 1. Remove ANY leading/trailing quotes, spaces, or newlines
        privateKey = privateKey.replace(/^['"\s]+|['"\s]+$/g, '');
        
        // 2. Handle escaped newlines
        if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        // 3. Final cleanup: trim and ensure it ends with the footer exactly
        privateKey = privateKey.trim();
        if (privateKey.includes('-----END PRIVATE KEY-----')) {
            const footerIndex = privateKey.indexOf('-----END PRIVATE KEY-----');
            privateKey = privateKey.substring(0, footerIndex + '-----END PRIVATE KEY-----'.length);
        }

        // High-visibility check on key structure
        const hasHeader = privateKey.startsWith('-----BEGIN PRIVATE KEY-----');
        const hasFooter = privateKey.endsWith('-----END PRIVATE KEY-----');
        
        console.log('[Firebase] Key structure check:');
        console.log('  - Starts with header:', hasHeader);
        console.log('  - Ends with footer:', hasFooter);
        console.log('  - Contains actual newlines:', privateKey.includes('\n'));
        console.log('  - Final length:', privateKey.length);

        if (!hasHeader || !hasFooter) {
            console.error('[Firebase] INVALID KEY FORMAT detected');
        }

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });

        console.log('Firebase Admin SDK initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('Firebase initialization error:', error.message);
        if (error.stack) {
            // Log a bit more for decoding errors
            if (error.message.includes('DECODER')) {
                console.error('[Firebase] Decoder error detected. This usually means the PRIVATE_KEY format in .env is incorrect.');
            }
        }
        return null;
    }
};

const getMessaging = () => {
    const app = initializeFirebase();
    if (!app) return null;
    return admin.messaging();
};

module.exports = {
    initializeFirebase,
    getMessaging,
    admin,
};
