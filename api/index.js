const axios = require('axios');
const admin = require('firebase-admin');

// ✅ Firebase Initialization
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    databaseURL: "https://happy-seller-3d85b-default-rtdb.firebaseio.com"
  });
  console.log('Firebase initialized successfully');
} catch (error) {
  console.log('Firebase initialization:', error.message);
}

const API_KEY = process.env.API_KEY;
const CLIENT_TOKEN = process.env.CLIENT_TOKEN; // 🔒 add this in Vercel Env

// ✅ Multiple Countries Database with Prices
const countries = {
  'india_66': { code: '66', name: 'WhatsApp Indian', country: 'India', price: 140, flag: '🇮🇳' },
  'india_115': { code: '115', name: 'WhatsApp Indian', country: 'India', price: 103, flag: '🇮🇳' },
  'vietnam_118': { code: '118', name: 'WhatsApp Vietnam', country: 'Vietnam', price: 61, flag: '🇻🇳' },
  'southafrica_52': { code: '52', name: 'WhatsApp South Africa', country: 'South Africa', price: 45, flag: '🇿🇦' },
  'colombia_53': { code: '53', name: 'WhatsApp Colombia', country: 'Colombia', price: 71, flag: '🇨🇴' },
  'philippines_51': { code: '51', name: 'WhatsApp Philippines', country: 'Philippines', price: 52, flag: '🇵🇭' },
  'philippines2_117': { code: '117', name: 'WhatsApp Philippines 2', country: 'Philippines', price: 64, flag: '🇵🇭' },
  // ✅ Indonesia Add करें
  'indonesia_54': { code: '54', name: 'WhatsApp Indonesia', country: 'Indonesia', price: 49, flag: '🇮🇩' }
};

module.exports = async (req, res) => {
  // ✅ Basic CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || '';
  const origin = req.headers['origin'] || '';
  const secFetchSite = (req.headers['sec-fetch-site'] || '').toLowerCase();
  const authHeader = (req.headers['authorization'] || '').trim();

  try {
    // ✅ Step 1: Browser / frontend check
    const isBrowser =
      userAgent.includes('Mozilla') &&
      (referer.includes('otpal.vercel.app') ||
        origin.includes('otpal.vercel.app') ||
        secFetchSite === 'same-origin' ||
        secFetchSite === 'same-site');

    // ✅ Step 2: Non-browser requests (e.g. Canary, curl, Postman)
    if (!isBrowser) {
      if (!authHeader || authHeader !== `Bearer ${CLIENT_TOKEN}`) {
        res.setHeader('Connection', 'close');
        return res.status(401).send(`<!DOCTYPE html>
<html>
<head><title>Access Blocked</title></head>
<body style="background:#111;color:#fff;text-align:center;padding:50px">
  <h1>🚫 Unauthorized Access</h1>
  <p>This endpoint is protected. Direct API access not allowed.</p>
  <p>Please use the official site 👉 <a href="https://otpal.vercel.app" style="color:#0ff">otpal.vercel.app</a></p>
</body>
</html>`);
      }
    }

    // ✅ Step 3: Normal API functionality
    if (path === 'health') {
      return res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        firebase: 'Connected',
        countries: Object.keys(countries).length
      });
    }

    if (path === 'getNumber') {
      const { countryKey = 'philippines_51' } = req.query;
      const countryConfig = countries[countryKey];

      if (!countryConfig) {
        return res.json({
          success: false,
          error: 'Invalid country selection'
        });
      }

      const url = `https://firexotp.com/stubs/handler_api.php?action=getNumber&api_key=${API_KEY}&service=wa&country=${countryConfig.code}`;
      const response = await axios.get(url);
      const data = response.data;

      const parts = data.split(':');
      if (parts[0] === 'ACCESS_NUMBER' && parts.length === 3) {
        return res.json({
          success: true,
          id: parts[1],
          number: parts[2],
          country: countryConfig.country,
          service: countryConfig.name,
          price: countryConfig.price
        });
      } else {
        return res.json({
          success: false,
          error: data
        });
      }
    }

    if (path === 'getCountries') {
      return res.json({
        success: true,
        countries
      });
    }

    if (path === 'getOtp') {
      const { id } = req.query;
      if (!id) {
        return res.json({ success: false, error: 'ID required' });
      }

      const url = `https://firexotp.com/stubs/handler_api.php?action=getStatus&api_key=${API_KEY}&id=${id}`;
      const response = await axios.get(url);

      return res.json({
        success: true,
        data: response.data
      });
    }

    if (path === 'cancelNumber') {
      const { id } = req.query;
      if (!id) {
        return res.json({ success: false, error: 'ID required' });
      }

      const url = `https://firexotp.com/stubs/handler_api.php?action=setStatus&api_key=${API_KEY}&id=${id}&status=8`;
      const response = await axios.get(url);

      return res.json({
        success: true,
        data: response.data
      });
    }

    return res.json({ error: 'Invalid path' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
