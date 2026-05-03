/**
 * Firebase Connection Test Script
 * Tests: Firebase Init, Firestore Read/Write, Storage, Auth
 * Run: node test-connections.mjs
 */

import { readFileSync } from 'fs';

// Load .env manually
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.trim().split('='))
);

const config = {
  apiKey:            env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const results = [];

function log(label, status, detail = '') {
  const line = `  ${status}  ${label}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ label, passed: status === PASS, detail });
}

console.log('\n══════════════════════════════════════════');
console.log('   Jagrut Firebase Connection Test');
console.log('══════════════════════════════════════════\n');

// ── 1. Check .env values ────────────────────────────────
console.log('📋 [1] Environment Variables');
const requiredKeys = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
for (const key of requiredKeys) {
  if (config[key] && !config[key].includes('YOUR_')) {
    log(key, PASS, config[key].slice(0, 30) + (config[key].length > 30 ? '…' : ''));
  } else {
    log(key, FAIL, 'missing or placeholder value');
  }
}

// ── 2. Firebase SDK imports ──────────────────────────────
console.log('\n🔥 [2] Firebase SDK');
let initializeApp, getFirestore, collection, doc, setDoc, getDoc, deleteDoc, getStorage;
try {
  ({ initializeApp } = await import('firebase/app'));
  log('firebase/app', PASS);
} catch(e) { log('firebase/app', FAIL, e.message); }

try {
  ({ getFirestore, collection, doc, setDoc, getDoc, deleteDoc } = await import('firebase/firestore'));
  log('firebase/firestore', PASS);
} catch(e) { log('firebase/firestore', FAIL, e.message); }

try {
  ({ getStorage } = await import('firebase/storage'));
  log('firebase/storage', PASS);
} catch(e) { log('firebase/storage', FAIL, e.message); }

// ── 3. Firebase App Init ─────────────────────────────────
console.log('\n🚀 [3] Firebase App Initialization');
let app, db, storage;
try {
  app = initializeApp(config);
  log('initializeApp()', PASS, `Project: ${config.projectId}`);
} catch(e) { log('initializeApp()', FAIL, e.message); process.exit(1); }

try {
  db = getFirestore(app);
  log('getFirestore()', PASS);
} catch(e) { log('getFirestore()', FAIL, e.message); }

try {
  storage = getStorage(app);
  log('getStorage()', PASS);
} catch(e) { log('getStorage()', FAIL, e.message); }

// ── 4. Firestore Write ───────────────────────────────────
console.log('\n📝 [4] Firestore Write Test');
const testDocRef = doc(db, '_connection_test', 'ping');
try {
  await setDoc(testDocRef, {
    timestamp: new Date().toISOString(),
    message: 'Connection test from new laptop',
    laptop: process.env.COMPUTERNAME || 'unknown',
  });
  log('Firestore setDoc()', PASS, 'wrote to _connection_test/ping');
} catch(e) {
  log('Firestore setDoc()', FAIL, e.message);
}

// ── 5. Firestore Read ────────────────────────────────────
console.log('\n📖 [5] Firestore Read Test');
try {
  const snap = await getDoc(testDocRef);
  if (snap.exists()) {
    log('Firestore getDoc()', PASS, `data: ${JSON.stringify(snap.data()).slice(0, 60)}`);
  } else {
    log('Firestore getDoc()', FAIL, 'document does not exist after write');
  }
} catch(e) {
  log('Firestore getDoc()', FAIL, e.message);
}

// ── 6. Firestore Cleanup ─────────────────────────────────
try {
  await deleteDoc(testDocRef);
  log('Firestore deleteDoc() cleanup', PASS);
} catch(e) {
  log('Firestore deleteDoc() cleanup', FAIL, e.message);
}

// ── 7. Firestore users collection ────────────────────────
console.log('\n👤 [6] Firestore users Collection');
try {
  const { getDocs, query, limit } = await import('firebase/firestore');
  const q = query(collection(db, 'users'), limit(1));
  const snap = await getDocs(q);
  log('Read users collection', PASS, `${snap.size} doc(s) found`);
} catch(e) {
  log('Read users collection', FAIL, e.message);
}

// ── 8. Firestore bills collection ────────────────────────
console.log('\n🧾 [7] Firestore bills Collection');
try {
  const { getDocs, query, limit } = await import('firebase/firestore');
  const q = query(collection(db, 'bills'), limit(1));
  const snap = await getDocs(q);
  log('Read bills collection', PASS, `${snap.size} doc(s) found`);
} catch(e) {
  log('Read bills collection', FAIL, e.message);
}

// ── 9. Firebase Storage ──────────────────────────────────
console.log('\n🪣 [8] Firebase Storage');
try {
  const { ref, uploadString, getDownloadURL, deleteObject } = await import('firebase/storage');
  const testRef = ref(storage, '_connection_test/ping.txt');
  await uploadString(testRef, 'connection-test');
  const url = await getDownloadURL(testRef);
  log('Storage upload + getDownloadURL', PASS, url.slice(0, 60) + '…');
  await deleteObject(testRef);
  log('Storage delete cleanup', PASS);
} catch(e) {
  log('Firebase Storage', FAIL, e.message);
}

// ── Summary ──────────────────────────────────────────────
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log('\n══════════════════════════════════════════');
console.log(`   Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════');
if (failed > 0) {
  console.log('\n⚠️  Failed checks:');
  results.filter(r => !r.passed).forEach(r => console.log(`   • ${r.label}: ${r.detail}`));
}
console.log('');
