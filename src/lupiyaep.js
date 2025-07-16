// 1. Add axios and nodemailer dependencies (run: npm install axios nodemailer)
import axios from 'axios';
import nodemailer from 'nodemailer';
import express from 'express'; // Use ESM import
const app = express();

const LUPIYA_CONFIG = {
  baseUrl: process.env.LUPIYA_CONFIG_baseUrl,
};

let accessToken = null;
let tokenExpiry = null;
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: 'info@lupiya.com', // Replace with your SMTP host
  port: 465, // Common SMTP port, adjust if needed (e.g., 465 for SSL)
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'supportlupiya@d2ctelcare.com', // Replace with your SMTP username
    pass: '!A#^X#)cnp0M' // Replace with your SMTP password
  }
});

// Function to authenticate and get a new token
async function fetchAccessToken() {
  try {
    const response = await axios.post(
      `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/token`,
      {
        email: process.env.LUPIYA_EMAIL,
        password: process.env.LUPIYA_PASSWORD,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    accessToken = response.data.access_token;
    // If the API returns expiry, set tokenExpiry accordingly
    // tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    console.error('Error fetching access token:', error.message);
    throw new Error('Failed to fetch access token');
  }
}

// Helper to get a valid token (fetch if missing/expired)
async function getAccessToken() {
  if (!accessToken /* || Date.now() > tokenExpiry */) {
    await fetchAccessToken();
  }
  return accessToken;
}

// 3. Add Lupiya service functions
class LupiyaService {
  static async getLoanStatement(idNumber) {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/loan-statement`,
        { idNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching loan statement:', error.message);
      throw new Error('Failed to fetch loan statement');
    }
  }

  static async getWalletBalance(idNumber) {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/wallet-balance`,
        { idNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token,
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet balance:', error.message);
      throw new Error('Failed to fetch wallet balance');
    }
  }

   static async getBankDetails() {
  try {
    // Hardcode the token temporarily for testing
    const token = 'ALSWoR5UNbUA638yz5ca5pZAjVUqq2R6AnPNGRyWtGX6JkEtXg1VQMygTATnqFEA'; // Replace with the actual token
    console.log('Using hardcoded token:', token);
    console.log('API URL:', `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/bank-repayment-details`);
    const response = await axios.get(
      `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/bank-repayment-details`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use Bearer format
        },
      }
    );
    console.log('Bank details response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching bank details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });
    throw new Error('Failed to fetch bank details');
  }
}

  static async requestUSSDPayment(idNumber, phoneNumber) {
    try {
      const token = await getAccessToken();
      const response = await axios.post(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/request-ussd-payment`,
        { idNumber, phoneNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token,
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error requesting USSD payment:', error.message);
      throw new Error('Failed to request USSD payment');
    }
  }
}

// Wallet Balance Endpoint
app.get('/wallet-balance', (req, res) => {
  const walletBalanceFlow = {
    "version": "7.1",
    "data_api_version": "3.0",
    "routing_model": {
      "WALLET_BALANCE_FORM": [],
    },
    "screens": [
      {
        "id": "WALLET_BALANCE_FORM",
        "title": "Wallet Balance",
        "layout": {
          "type": "SingleColumnLayout",
          "children": [
            { "type": "TextHeading", "text": "Check Wallet Balance" },
            { "type": "TextBody", "text": "Enter your NRC number to check your wallet balance:" },
            {
              "type": "Form",
              "name": "wallet_balance_form",
              "children": [
                {
                  "type": "TextInput",
                  "label": "NRC Number",
                  "name": "nrc_number",
                  "helper-text": "Enter your NRC number (e.g., 123456/78/9)",
                  "required": true
                },
                {
                  "type": "Footer",
                  "label": "Check Balance",
                  "on-click-action": {
                    "name": "data_exchange",
                    "payload": {
                      "action": "get_wallet_balance",
                      "nrc_number": "${form.nrc_number}"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
  res.json(walletBalanceFlow);
});

// Bank Details Endpoint
app.get('/bank-details', (req, res) => {
  const bankDetailsFlow = {
    "version": "7.1",
    "data_api_version": "3.0",
    "routing_model": {
      "BANK_DETAILS_FORM": [],
    },
    "screens": [
      {
        "id": "BANK_DETAILS_FORM",
        "title": "Bank Details",
        "layout": {
          "type": "SingleColumnLayout",
          "children": [
            { "type": "TextHeading", "text": "Bank Repayment Details" },
            { "type": "TextBody", "text": "Get bank details for loan repayment:" },
            {
              "type": "Form",
              "name": "bank_details_form",
              "children": [
                {
                  "type": "Footer",
                  "label": "Get Bank Details",
                  "on-click-action": {
                    "name": "data_exchange",
                    "payload": {
                      "action": "get_bank_details"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
  res.json(bankDetailsFlow);
});

// USSD Payment Endpoint
app.get('/ussd-payment', (req, res) => {
  const ussdPaymentFlow = {
    "version": "7.1",
    "data_api_version": "3.0",
    "routing_model": {
      "USSD_PAYMENT_FORM": [],
    },
    "screens": [
      {
        "id": "USSD_PAYMENT_FORM",
        "title": "USSD Payment",
        "layout": {
          "type": "SingleColumnLayout",
          "children": [
            { "type": "TextHeading", "text": "Request USSD Payment" },
            { "type": "TextBody", "text": "Request a USSD payment prompt to your mobile money:" },
            {
              "type": "Form",
              "name": "ussd_payment_form",
              "children": [
                {
                  "type": "TextInput",
                  "label": "NRC Number",
                  "name": "nrc_number",
                  "helper-text": "Enter your NRC number (e.g., 123456/78/9)",
                  "required": true
                },
                {
                  "type": "TextInput",
                  "label": "Phone Number",
                  "name": "phone_number",
                  "input-type": "phone",
                  "helper-text": "Enter phone number in E.164 format (e.g., +260971234567)",
                  "required": true
                },
                {
                  "type": "Footer",
                  "label": "Request Payment",
                  "on-click-action": {
                    "name": "data_exchange",
                    "payload": {
                      "action": "request_ussd_payment",
                      "nrc_number": "${form.nrc_number}",
                      "phone_number": "${form.phone_number}"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
  res.json(ussdPaymentFlow);
});

// Data Exchange Handler
app.post('/data-exchange', async (req, res) => {
  try {
    const { action, nrc_number, phone_number } = req.body;
    let result;
    let responseScreen;

    switch (action) {
      case 'get_loan_statement':
        result = await LupiyaService.getLoanStatement(nrc_number);
        responseScreen = {
          "id": "LOAN_STATEMENT_RESULT",
          "title": "Loan Statement",
          "terminal": true,
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              { "type": "TextHeading", "text": "Your Loan Statement" },
              {
                "type": "TextBody",
                "text": result.data && Array.isArray(result.data)
                  ? result.data.map(item =>
                      `Date: ${new Date(item.dateOfPayment).toLocaleDateString()}\n` +
                      `Type: ${item.type}\n` +
                      `Amount: ZMW ${Number(item.amountPaid).toFixed(2)}\n` +
                      `Balance: ZMW ${Number(item.loanBalance).toFixed(2)}\n`
                    ).join('\n')
                  : "No loan statement data found."
              }
            ]
          }
        };
        break;

      case 'get_wallet_balance':
        result = await LupiyaService.getWalletBalance(nrc_number);
        responseScreen = {
          "id": "WALLET_BALANCE_RESULT",
          "title": "Wallet Balance",
          "terminal": true,
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              { "type": "TextHeading", "text": "Your Wallet Balance" },
              { "type": "TextBody", "text": `Current Balance: ZMW ${result.walletBalance}` }
            ]
          }
        };
        break;

      case 'get_bank_details':
        result = await LupiyaService.getBankDetails();
        responseScreen = {
          "id": "BANK_DETAILS_RESULT",
          "title": "Bank Details",
          "terminal": true,
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              { "type": "TextHeading", "text": "Bank Repayment Details" },
              {
                "type": "TextBody",
                "text": result.data.map(bank => 
                  `Bank: ${bank.bankName}\\n` +
                  `Account: ${bank.bankAccountNumber}\\n` +
                  `Branch: ${bank.bankBranch}\\n\\n`
                ).join('')
              }
            ]
          }
        };
        break;

      case 'request_ussd_payment':
        result = await LupiyaService.requestUSSDPayment(nrc_number, phone_number);
        responseScreen = {
          "id": "USSD_PAYMENT_RESULT",
          "title": "USSD Payment",
          "terminal": true,
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              { "type": "TextHeading", "text": "Payment Request Sent" },
              { "type": "TextBody", "text": result.message }
            ]
          }
        };
        break;

      default:
        throw new Error('Unknown action');
    }

    res.json({
      "version": "7.1",
      "screen": responseScreen
    });

  } catch (error) {
    console.error('Data exchange error:', error.message);
    res.json({
      "version": "7.1",
      "screen": {
        "id": "ERROR_SCREEN",
        "title": "Error",
        "terminal": true,
        "layout": {
          "type": "SingleColumnLayout",
          "children": [
            { "type": "TextHeading", "text": "Service Error" },
            { "type": "TextBody", "text": `Sorry, we encountered an error: ${error.message}\\n\\nPlease try again later.` }
          ]
        }
      }
    });
  }
});

export default app; // Export as default for ESM