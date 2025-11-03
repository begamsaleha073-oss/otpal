const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Initialization
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    databaseURL: "https://happy-seller-3d85b-default-rtdb.firebaseio.com"
  });
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.log('❌ Firebase initialization failed:', error.message);
}

const API_KEY = process.env.API_KEY;

// ✅ Countries Database
const countries = {
  'india_66': { code: '66', name: 'WhatsApp Indian', country: 'India', price: 140, flag: '🇮🇳' },
  'india_115': { code: '115', name: 'WhatsApp Indian', country: 'India', price: 103, flag: '🇮🇳' },
  'vietnam_118': { code: '118', name: 'WhatsApp Vietnam', country: 'Vietnam', price: 61, flag: '🇻🇳' },
  'southafrica_52': { code: '52', name: 'WhatsApp South Africa', country: 'South Africa', price: 45, flag: '🇿🇦' },
  'colombia_53': { code: '53', name: 'WhatsApp Colombia', country: 'Colombia', price: 71, flag: '🇨🇴' },
  'philippines_51': { code: '51', name: 'WhatsApp Philippines', country: 'Philippines', price: 52, flag: '🇵🇭' },
  'philippines2_117': { code: '117', name: 'WhatsApp Philippines 2', country: 'Philippines', price: 64, flag: '🇵🇭' }
};

// ✅ REAL OWNID Validation with Firebase
async function validateOwnId(ownid) {
  try {
    console.log('🔍 Validating OWNID:', ownid);
    
    if (!ownid || ownid.length < 5) {
      return null;
    }

    // ✅ Firebase se check karo
    const snapshot = await admin.database().ref('userApiKeys/' + ownid).once('value');
    const userId = snapshot.val();
    
    if (!userId) {
      console.log('❌ OWNID not found in database:', ownid);
      return null;
    }

    // ✅ User data get karo
    const userSnapshot = await admin.database().ref('users/' + userId).once('value');
    const userData = userSnapshot.val();
    
    if (!userData) {
      console.log('❌ User data not found for ID:', userId);
      return null;
    }

    console.log('✅ OWNID validated successfully:', ownid);
    return { ...userData, userId: userId };
    
  } catch (error) {
    console.error('❌ OWNID validation error:', error);
    return null;
  }
}

// ✅ Balance Deduction Function
async function deductBalance(userId, amount) {
  try {
    const userRef = admin.database().ref('users/' + userId + '/wallet');
    
    const result = await userRef.transaction((currentBalance) => {
      if (currentBalance === null) return currentBalance;
      if (currentBalance < amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      return currentBalance - amount;
    });
    
    return { success: true, newBalance: result.snapshot.val() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, ownid, countryKey, id } = req.query;

  console.log('📥 API Request:', { path, ownid, countryKey, id });

  try {
    // ✅ HEALTH CHECK
    if (path === 'health') {
      return res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        firebase: 'Connected'
      });
    }

    // ✅ OWNID REQUIRED
    if (!ownid) {
      return res.json({
        success: false,
        error: 'OWNID_REQUIRED',
        message: 'Please provide your API key'
      });
    }

    // ✅ REAL OWNID VALIDATION
    const userData = await validateOwnId(ownid);
    if (!userData) {
      return res.json({
        success: false,
        error: 'INVALID_OWNID',
        message: 'Invalid API key or user not found',
        your_ownid: ownid
      });
    }

    console.log('✅ User authenticated:', userData.email);

    // ✅ GET COUNTRIES
    if (path === 'getCountries') {
      return res.json({
        success: true,
        countries: countries,
        balance: userData.wallet || 0,
        email: userData.email
      });
    }

    // ✅ GET NUMBER
    if (path === 'getNumber') {
      const countryKeyToUse = countryKey || 'philippines_51';
      const countryConfig = countries[countryKeyToUse];
      
      if (!countryConfig) {
        return res.json({
          success: false,
          error: 'INVALID_COUNTRY'
        });
      }

      const price = countryConfig.price;

      // ✅ Balance check
      if (!userData.wallet || userData.wallet < price) {
        return res.json({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Required: ₹${price}, Available: ₹${userData.wallet || 0}`
        });
      }

      // ✅ Balance deduct karo
      const deduction = await deductBalance(userData.userId, price);
      if (!deduction.success) {
        return res.json({
          success: false,
          error: 'DEDUCTION_FAILED'
        });
      }

      // ✅ FirexOTP API call
      try {
        const API_KEY = process.env.API_KEY;
        const url = `https://firexotp.com/stubs/handler_api.php?action=getNumber&api_key=${API_KEY}&service=wa&country=${countryConfig.code}`;
        
        const response = await axios.get(url);
        const data = response.data;

        console.log('🔥 FirexOTP Response:', data);

        const parts = data.split(':');
        if (parts[0] === 'ACCESS_NUMBER' && parts.length === 3) {
          return res.json({
            success: true,
            id: parts[1],
            number: parts[2],
            country: countryConfig.country,
            service: countryConfig.name,
            price: price,
            balance: deduction.newBalance,
            email: userData.email
          });
        } else {
          // ✅ Refund on error
          await refundBalance(userData.userId, price, 'api_error');
          return res.json({
            success: false,
            error: data
          });
        }
      } catch (error) {
        // ✅ Refund on network error
        await refundBalance(userData.userId, price, 'network_error');
        return res.json({
          success: false,
          error: 'FIREXOTP_API_ERROR'
        });
      }
    }

    // ✅ Other API endpoints...
    // [GET OTP, CANCEL NUMBER etc.]

    return res.json({ 
      success: false,
      error: 'INVALID_PATH'
    });

  } catch (error) {
    console.error('🚨 API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};
