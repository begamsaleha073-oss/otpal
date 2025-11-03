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
const CLIENT_TOKEN = process.env.CLIENT_TOKEN; // ✅ add this in Vercel env

module.exports = async (req, res) => {
  // Basic CORS
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
    // ✅ STEP 1: Browser-origin check (frontend unchanged)
    const isBrowser =
      userAgent.includes('Mozilla') &&
      (referer.includes('otpal.vercel.app') ||
        origin.includes('otpal.vercel.app') ||
        secFetchSite === 'same-origin' ||
        secFetchSite === 'same-site');

    // ✅ STEP 2: Non-browser (tool/bot) → require CLIENT_TOKEN
    if (!isBrowser) {
      if (!authHeader || authHeader !== `Bearer ${CLIENT_TOKEN}`) {
        // agar koi tool use kar raha hai bina key ke — block karo
        res.setHeader('Connection', 'close');
        return res.status(401).send(`<!DOCTYPE html>
<html>
<head><title>Access Blocked</title></head>
<body style="background:#111;color:#fff;text-align:center;padding:50px">
  <h1>🚫 Unauthorized Access</h1>
  <p>This endpoint is protected. Direct API access not allowed.</p>
</body>
</html>`);
      }
    }

    // ✅ STEP 3: Health route
    if (path === 'health') {
      return res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        firebase: 'Connected'
      });
    }

    // ✅ STEP 4: Normal API logic (unchanged)
    if (path === 'getNumber') {
      const url = `https://firexotp.com/stubs/handler_api.php?action=getNumber&api_key=${API_KEY}&service=wa&country=51`;
      const response = await axios.get(url);
      const data = response.data;

      const parts = data.split(':');
      if (parts[0] === 'ACCESS_NUMBER' && parts.length === 3) {
        return res.json({
          success: true,
          id: parts[1],
          number: parts[2]
        });
      } else {
        return res.json({
          success: false,
          error: data
        });
      }
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
