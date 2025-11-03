const axios = require('axios');
const admin = require('firebase-admin');

// ✅ Firebase Initialization with DEBUG
console.log('🔄 Starting Firebase initialization...');
console.log('🔍 Environment Check:');
console.log('   Project ID:', process.env.FIREBASE_PROJECT_ID ? '✅ SET' : '❌ NOT SET');
console.log('   Client Email:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ SET' : '❌ NOT SET');
console.log('   Private Key:', process.env.FIREBASE_PRIVATE_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   API Key:', process.env.API_KEY ? '✅ SET' : '❌ NOT SET');

try {
  // ✅ Firebase initialization
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };

  console.log('📝 Service Account Details:');
  console.log('   Project ID:', serviceAccount.projectId);
  console.log('   Client Email:', serviceAccount.clientEmail);
  console.log('   Private Key Length:', serviceAccount.privateKey?.length || 0);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://happy-seller-3d85b-default-rtdb.firebaseio.com"
  });

  console.log('✅ Firebase App initialized successfully');

  // ✅ Test database connection
  console.log('🔄 Testing database connection...');
  const testRef = admin.database().ref('test_connection');
  await testRef.set({ 
    timestamp: Date.now(),
    message: 'Test from backend API',
    status: 'success'
  });
  console.log('✅ Database write test: SUCCESS');

  const snapshot = await testRef.once('value');
  console.log('✅ Database read test: SUCCESS');
  console.log('   Test data:', snapshot.val());

  // ✅ Check if users exist
  const usersRef = admin.database().ref('users');
  const usersSnapshot = await usersRef.once('value');
  const usersData = usersSnapshot.val();
  console.log('📊 Users in database:', usersData ? Object.keys(usersData).length : 0);
  
  if (usersData) {
    console.log('👥 Users list:');
    Object.keys(usersData).forEach(userId => {
      console.log(`   - ${userId}:`, usersData[userId].email, 'OWNID:', usersData[userId].ownId);
    });
  }

} catch (error) {
  console.log('❌ Firebase initialization FAILED:');
  console.log('   Error:', error.message);
  console.log('   Stack:', error.stack);
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

// ✅ REAL OWNID Validation with DEBUG
async function validateOwnId(ownid) {
  try {
    console.log('🔍 Validating OWNID:', ownid);
    
    if (!ownid || ownid.length < 5) {
      console.log('❌ OWNID too short or empty');
      return null;
    }

    // ✅ Firebase se check karo
    console.log('   Checking userApiKeys for:', ownid);
    const snapshot = await admin.database().ref('userApiKeys/' + ownid).once('value');
    const userId = snapshot.val();
    
    console.log('   Found userId:', userId);
    
    if (!userId) {
      console.log('❌ OWNID not found in database');
      return null;
    }

    // ✅ User data get karo
    console.log('   Fetching user data for:', userId);
    const userSnapshot = await admin.database().ref('users/' + userId).once('value');
    const userData = userSnapshot.val();
    
    console.log('   User data found:', userData ? 'YES' : 'NO');
    
    if (!userData) {
      console.log('❌ User data not found');
      return null;
    }

    console.log('✅ OWNID validated successfully');
    console.log('   User:', userData.email, 'Balance:', userData.wallet);
    return { ...userData, userId: userId };
    
  } catch (error) {
    console.error('❌ OWNID validation error:', error.message);
    return null;
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

  console.log('\n📥 NEW API REQUEST ==================');
  console.log('   Path:', path);
  console.log('   OWNID:', ownid);
  console.log('   Country:', countryKey);
  console.log('   ID:', id);

  try {
    // ✅ HEALTH CHECK
    if (path === 'health') {
      console.log('🔧 Health check requested');
      return res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        firebase: 'Initialized',
        debug: {
          project_id: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT_SET',
          client_email: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT_SET',
          users_in_db: 'Check logs'
        }
      });
    }

    // ✅ OWNID REQUIRED
    if (!ownid) {
      console.log('❌ OWNID missing');
      return res.json({
        success: false,
        error: 'OWNID_REQUIRED',
        message: 'Please provide your API key'
      });
    }

    // ✅ REAL OWNID VALIDATION
    console.log('🔐 Starting OWNID validation...');
    const userData = await validateOwnId(ownid);
    
    if (!userData) {
      console.log('❌ OWNID validation FAILED');
      return res.json({
        success: false,
        error: 'INVALID_OWNID',
        message: 'Invalid API key or user not found',
        your_ownid: ownid,
        debug_note: 'Check backend logs for details'
      });
    }

    console.log('✅ OWNID validation SUCCESS');
    console.log('   User:', userData.email, 'Balance:', userData.wallet);

    // ✅ GET COUNTRIES
    if (path === 'getCountries') {
      console.log('🌍 Get countries requested');
      return res.json({
        success: true,
        countries: countries,
        balance: userData.wallet || 0,
        email: userData.email,
        your_ownid: ownid
      });
    }

    // ✅ GET NUMBER
    if (path === 'getNumber') {
      console.log('📞 Get number requested');
      const countryKeyToUse = countryKey || 'philippines_51';
      const countryConfig = countries[countryKeyToUse];
      
      if (!countryConfig) {
        console.log('❌ Invalid country:', countryKey);
        return res.json({
          success: false,
          error: 'INVALID_COUNTRY'
        });
      }

      const price = countryConfig.price;
      console.log('   Country:', countryConfig.country, 'Price:', price);

      // ✅ Balance check
      if (!userData.wallet || userData.wallet < price) {
        console.log('❌ Insufficient balance:', userData.wallet, '<', price);
        return res.json({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Required: ₹${price}, Available: ₹${userData.wallet || 0}`
        });
      }

      console.log('✅ Balance sufficient, proceeding...');

      // ✅ Temporary response (FirexOTP fix karne tak)
      return res.json({
        success: true,
        id: "temp_" + Date.now(),
        number: "+639123456789",
        country: countryConfig.country,
        service: countryConfig.name,
        price: price,
        balance: (userData.wallet || 0) - price,
        email: userData.email,
        your_ownid: ownid,
        note: "This is a temporary response - Firebase is working!"
      });
    }

    console.log('❌ Invalid path:', path);
    return res.json({ 
      success: false,
      error: 'INVALID_PATH',
      debug: {
        your_ownid: ownid,
        user_email: userData.email
      }
    });

  } catch (error) {
    console.error('🚨 API Error:', error.message);
    console.error('   Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      debug_error: error.message
    });
  }
};
