const axios = require('axios');

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

// ✅ Temporary User Database
const tempUsers = {
  'demo_user': {
    userId: 'demo_user',
    wallet: 1000,
    email: 'demo@example.com'
  }
};

const tempApiKeys = {
  'demo_key': 'demo_user',
  'test123': 'demo_user'
};

module.exports = async (req, res) => {
  // CORS - Allow all
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path, ownid, countryKey, id } = req.query;

  try {
    // ✅ HEALTH CHECK - No OWNID needed
    if (path === 'health') {
      return res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        demo_keys: ['demo_key', 'test123'],
        note: 'Use demo_key or test123 for testing'
      });
    }

    // ✅ OWNID REQUIRED for all other endpoints
    if (!ownid) {
      return res.json({
        success: false,
        error: 'OWNID_REQUIRED',
        message: 'Please provide your API key in ownid parameter',
        demo_keys: ['demo_key', 'test123']
      });
    }

    // ✅ Validate OWNID
    const userId = tempApiKeys[ownid];
    if (!userId) {
      return res.json({
        success: false,
        error: 'INVALID_OWNID',
        message: 'Invalid API key or user not found',
        demo_keys: ['demo_key', 'test123'],
        your_key: ownid
      });
    }

    const userData = tempUsers[userId];

    // ✅ GET COUNTRIES
    if (path === 'getCountries') {
      return res.json({
        success: true,
        countries: countries,
        balance: userData.wallet,
        demo: true
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
      if (userData.wallet < price) {
        return res.json({
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: `Required: ₹${price}, Available: ₹${userData.wallet}`
        });
      }

      // ✅ Actual API call to firexotp
      try {
        // Yahan apna actual FirexOTP API key use kare
        const API_KEY = process.env.API_KEY || "your_firexotp_api_key_here";
        const url = `https://firexotp.com/stubs/handler_api.php?action=getNumber&api_key=${API_KEY}&service=wa&country=${countryConfig.code}`;
        const response = await axios.get(url);
        const data = response.data;

        const parts = data.split(':');
        if (parts[0] === 'ACCESS_NUMBER' && parts.length === 3) {
          // ✅ Balance deduct karo
          userData.wallet -= price;
          
          return res.json({
            success: true,
            id: parts[1],
            number: parts[2],
            country: countryConfig.country,
            service: countryConfig.name,
            price: price,
            balance: userData.wallet,
            demo: true
          });
        } else {
          return res.json({
            success: false,
            error: data,
            message: 'FirexOTP API error'
          });
        }
      } catch (error) {
        return res.json({
          success: false,
          error: 'FIREXOTP_API_ERROR',
          message: error.message
        });
      }
    }

    // ✅ GET OTP
    if (path === 'getOtp') {
      if (!id) {
        return res.json({ 
          success: false, 
          error: 'ID_REQUIRED'
        });
      }

      try {
        const API_KEY = process.env.API_KEY || "your_firexotp_api_key_here";
        const url = `https://firexotp.com/stubs/handler_api.php?action=getStatus&api_key=${API_KEY}&id=${id}`;
        const response = await axios.get(url);

        return res.json({
          success: true,
          data: response.data,
          balance: userData.wallet,
          demo: true
        });
      } catch (error) {
        return res.json({
          success: false,
          error: 'FIREXOTP_API_ERROR',
          message: error.message
        });
      }
    }

    // ✅ CANCEL NUMBER
    if (path === 'cancelNumber') {
      if (!id) {
        return res.json({ 
          success: false, 
          error: 'ID_REQUIRED'
        });
      }

      try {
        const API_KEY = process.env.API_KEY || "your_firexotp_api_key_here";
        const url = `https://firexotp.com/stubs/handler_api.php?action=setStatus&api_key=${API_KEY}&id=${id}&status=8`;
        const response = await axios.get(url);

        // ✅ Refund amount
        const refundAmount = 52;
        userData.wallet += refundAmount;

        return res.json({
          success: true,
          data: response.data,
          refunded: true,
          refundAmount: refundAmount,
          balance: userData.wallet,
          demo: true
        });
      } catch (error) {
        return res.json({
          success: false,
          error: 'FIREXOTP_API_ERROR', 
          message: error.message
        });
      }
    }

    return res.json({ 
      success: false,
      error: 'INVALID_PATH'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};
