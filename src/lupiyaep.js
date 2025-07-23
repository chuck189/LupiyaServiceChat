// 1. Add axios and nodemailer dependencies (run: npm install axios nodemailer)
import axios from 'axios';
import nodemailer from 'nodemailer';
import express from 'express'; // Use ESM import
const app = express();

const LUPIYA_CONFIG = {
  baseUrl: process.env.LUPIYA_BASE_URL || 'https://backend.qa.lupiya.com',
};

export { app as default, LupiyaService };
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: 'mail.d2ctelcare.com', // Replace with your SMTP host
  port: 465, // Common SMTP port, adjust if needed (e.g., 465 for SSL)
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'chibuye@d2ctelcare.com', // Replace with your SMTP username
    pass: 's3fqu6]Ebj@Q' // Replace with your SMTP password
  }
});

// Function to authenticate and get a new token
async function getAccessToken() {
  const token = process.env.LUPIYA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('accessToken is not defined in environment variables');
  }
  return token;
}

// Helper to get a valid token (fetch if missing/expired)

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
// Get BankDetails
   static async getBankDetails() {
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/bank-repayment-details`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': token
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching bank details:', error.message);
    throw new Error('Failed to fetch bank details');
  }
}

//Get Loan Topup Range By ID Number
static async getLoanTopupRange(idNumber) {
  try {
    const token = await getAccessToken();
    const response = await axios.post(
      `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/top-up-range`,
      { idNumber },
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': token
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching loan topup range:', error.message);
    throw new Error('Failed to fetch loan topup range');
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

// New endpoint to send email with request body
app.post('/send-email', async (req, res) => {
  try {
    if (!process.env.SMTP_RECIPIENT) {
      throw new Error('SMTP_RECIPIENT is not set in environment variables');
    }

    await sendWebhookEmail(req.body);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error in /webhook/send-email:', error.message);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

async function sendWebhookEmail(decryptedBody, screenResponse) {
  try {
    const mailOptions = {
      from: SMTP_EMAIL || 'chibuye@d2ctelcare.com', // Sender email
      to: 'nick.snapper@d2ctelcare.com', // Replace with the recipient's email address
      subject: 'WhatsApp Chatbot Webhook Triggered',
      text: `
        WhatsApp Chatbot Webhook was hit.

        Decrypted Request Body:
        ${JSON.stringify(decryptedBody, null, 2)}

        Response Sent:
        ${JSON.stringify(screenResponse, null, 2)}
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully with webhook details');
  } catch (error) {
    console.error('Error sending email:', error.message);
  }
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Lupiya WhatsApp API Service",
    version: "2.0.0",
    endpoints: [
      "GET /api/loan-statement/:nrc - Get loan statement",
      "POST /api/loan-statement - Get loan statement (JSON body)",
      "GET /api/topup-range/:nrc - Get loan topup range",
      "POST /api/topup-range - Get loan topup range (JSON body)",
      "GET /api/wallet-balance/:nrc - Get wallet balance",
      "POST /api/wallet-balance - Get wallet balance (JSON body)",
      "GET /api/bank-details - Get bank repayment details",
      "POST /api/ussd-payment - Request USSD payment",
      "POST /webhook - WhatsApp webhook receiver"
    ],
    lupiya_config: {
      baseUrl: process.env.LUPIYA_BASE_URL,
      hasToken: !!process.env.LUPIYA_ACCESS_TOKEN
    }
  });
});

// API Router for Direct Endpoints
const apiRouter = express.Router();

// Loan Statement GET
apiRouter.get('/loan-statement/:nrc', async (req, res) => {
  try {
    const { nrc } = req.params;
    const result = await LupiyaService.getLoanStatement(nrc);
    const message = `📊 *Loan Statement for ${nrc}*\n\n` + 
      result.data.map(item => 
        `Date: ${new Date(item.dateOfPayment).toLocaleDateString()}\n` +
        `Type: ${item.type}\n` +
        `Amount: ZMW ${Number(item.amountPaid).toFixed(2)}\n` +
        `Balance: ZMW ${Number(item.loanBalance).toFixed(2)}\n`
      ).join('\n---\n\n');
    res.json({
      success: true,
      message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Loan Statement POST
apiRouter.post('/loan-statement', async (req, res) => {
  try {
    const { nrc } = req.body;
    if (!nrc) {
      return res.status(400).json({
        success: false,
        message: '❌ NRC number is required'
      });
    }
    const result = await LupiyaService.getLoanStatement(nrc);
    const message = `📊 *Loan Statement for ${nrc}*\n\n` + 
      result.data.map(item => 
        `Date: ${new Date(item.dateOfPayment).toLocaleDateString()}\n` +
        `Type: ${item.type}\n` +
        `Amount: ZMW ${Number(item.amountPaid).toFixed(2)}\n` +
        `Balance: ZMW ${Number(item.loanBalance).toFixed(2)}\n`
      ).join('\n---\n\n');
    res.json({
      success: true,
      message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Topup Range GET
apiRouter.get('/topup-range/:nrc', async (req, res) => {
  try {
    const { nrc } = req.params;
    const result = await LupiyaService.getLoanTopupRange(nrc);
    const message = `💰 *Loan Topup Available for ${nrc}*\n\n` +
      `Loan Type: ${result.loanType}\n` +
      `Minimum: ZMW ${result.amountRange.min}\n` +
      `Maximum: ZMW ${result.amountRange.max}`;
    res.json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Topup Range POST
apiRouter.post('/topup-range', async (req, res) => {
  try {
    const { nrc } = req.body;
    if (!nrc) {
      return res.status(400).json({
        success: false,
        message: '❌ NRC number is required'
      });
    }
    const result = await LupiyaService.getLoanTopupRange(nrc);
    const message = `💰 *Loan Topup Available for ${nrc}*\n\n` +
      `Loan Type: ${result.loanType}\n` +
      `Minimum: ZMW ${result.amountRange.min}\n` +
      `Maximum: ZMW ${result.amountRange.max}`;
    res.json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Wallet Balance GET
apiRouter.get('/wallet-balance/:nrc', async (req, res) => {
  try {
    const { nrc } = req.params;
    const result = await LupiyaService.getWalletBalance(nrc);
    const message = `💰 *Wallet Balance for ${nrc}*\n\nCurrent Balance: ZMW ${result.walletBalance}`;
    res.json({
      success: true,
      message,
      data: { walletBalance: result.walletBalance }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Wallet Balance POST
apiRouter.post('/wallet-balance', async (req, res) => {
  try {
    const { nrc } = req.body;
    if (!nrc) {
      return res.status(400).json({
        success: false,
        message: '❌ NRC number is required'
      });
    }
    const result = await LupiyaService.getWalletBalance(nrc);
    const message = `💰 *Wallet Balance for ${nrc}*\n\nCurrent Balance: ZMW ${result.walletBalance}`;
    res.json({
      success: true,
      message,
      data: { walletBalance: result.walletBalance }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Bank Details GET
apiRouter.get('/bank-details', async (req, res) => {
  try {
    const result = await LupiyaService.getBankDetails();
    const message = `🏦 *Bank Repayment Details*\n\n` +
      result.data.map(bank => 
        `Bank: ${bank.bankName}\n` +
        `Account: ${bank.bankAccountNumber}\n` +
        `Branch: ${bank.bankBranch}\n`
      ).join('\n');
    res.json({
      success: true,
      message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// USSD Payment POST
apiRouter.post('/ussd-payment', async (req, res) => {
  try {
    const { nrc, phoneNumber } = req.body;
    if (!nrc || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: '❌ NRC number and phone number are required'
      });
    }
    const result = await LupiyaService.requestUSSDPayment(nrc, phoneNumber);
    const message = `📱 *USSD Payment Request*\n\n${result.message}`;
    res.json({
      success: true,
      message,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Mount the API router under /api
app.use('/api', apiRouter);
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
