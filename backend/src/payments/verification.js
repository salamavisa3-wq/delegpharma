// Automated verification script for DelegPharma payment system

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Check qr.js and adapter.js with node --check
const jsFiles = ['qr.js', 'adapter.js'];

jsFiles.forEach(file => {
  console.log(`
Running node --check on ${file}...
`);
  execSync(`node --check ${path.resolve(__dirname, file)}`, { stdio: 'inherit' });
});

// 2. Test createPayment function
const { providers } = require('./adapter');

try {
  console.log('

Testing providers.qr.createPayment...');
  const result = providers.qr.createPayment('test_reference', 1000);
  console.log('Payment result:', result);
  if (!result.provider || !result.qr_wave_url || !result.qr_om_url) {
    throw new Error('Invalid payment response structure');
  }
  console.log('Validation successful: ', result);
} catch (error) {
  console.error('Payment test failed:', error.message);
  process.exit(1);
}

// 3. Test live URLs
const urls = [
  { url: '/tarifs', expectedContent: /(qr|Wave|Orange Money|PayPal)/i },
  { url: '/inscription', expectedContent: /(qr|Wave|Orange Money|PayPal)/i },
  { url: '/assets/qr-wave.jpg' },
  { url: '/assets/qr-om.jpg' },
  { url: '/api/health', expectedContent: /QR|Wave|Orange Money|PayPal/i }
];

async function checkUrl(url) {
  const resp = await fetch(`http://localhost:3000${url}`).then(res => res.text());
  if (!resp.match(url.expectedContent)) {
    console.error(`URL check failed: ${url.url}`);
    process.exit(1);
  }
  console.log(`URL ${url.url} passed`);
}

Promise.all(urls.map(checkUrl)).catch(err => { throw err; });

// 4. Test unauthenticated POST
console.log('

Testing unauthenticated POST to /api/abonnements/initier...');
const response = await fetch('http://localhost:3000/api/abonnements/initier', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}
});

if (response.status !== 401) {
  console.error('Unauthenticated POST returns', response.status);
  process.exit(1);
}

console.log('Unauthenticated POST test passed');

console.log('

✓ All verification checks passed!')