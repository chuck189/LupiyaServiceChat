import express from "express";
import { decryptRequest, encryptResponse, FlowEndpointException } from "./encryption.js";
import { getNextScreen } from "./flow.js";
import crypto from "crypto";
import { default as lupiyaEndpoints, LupiyaService } from "./lupiyaep.js";
import nodemailer from "nodemailer";
const app = express();

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);

const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "", PORT = "3000" , SMTP_EMAIL, SMTP_PASSWORD } = process.env;
// Configure Nodemailer transporter (reuse the same config as in lupiyaep.js)
const transporter = nodemailer.createTransport({
  host: 'mail.d2ctelcare.com', // Replace with your SMTP host
  port: 465, // Common SMTP port, adjust if needed (e.g., 465 for SSL)
  secure: true, // true for 465, false for other ports
  auth: {
    user: SMTP_EMAIL || 'supportlupiya@d2ctelcare.com', // Use env variable or fallback
    pass: SMTP_PASSWORD || '!A#^X#)cnp0M' // Use env variable or fallback
  }
});

// Function to send email with request and response details
async function sendWebhookEmail(decryptedBody, screenResponse) {
  try {
    const mailOptions = {
      from: SMTP_EMAIL || 'supportlupiya@d2ctelcare.com', // Sender email
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

// New endpoint to send email with request body
app.post("/send-email", async (req, res) => {
  try {
    if (!SMTP_RECIPIENT) {
      throw new Error('SMTP_RECIPIENT is not set in environment variables');
    }

    const mailOptions = {
      from: SMTP_EMAIL || 'supportlupiya@d2ctelcare.com',
      to: SMTP_RECIPIENT,
      subject: 'Chatbot Email Endpoint Triggered',
      text: `
        Chatbot email endpoint was hit.

        Request Body:
        ${JSON.stringify(req.body, null, 2)}
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully from /send-email endpoint');

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email from /send-email:', error.message);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

app.post("/", async (req, res) => {
  if (!PRIVATE_KEY) throw new Error('Private key is empty. Please check your env variable "PRIVATE_KEY".');
  if (!isRequestSignatureValid(req)) return res.status(432).send();

  let decryptedRequest = null;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error(err);
    if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", screenResponse);

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
});

app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.\nCheckout README.md to start.</pre>`);
});

app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Lupiya WhatsApp API Service",
    version: "2.0.0",
    endpoints: [
      "GET /api/loan-statement/:nrc",
      "POST /api/loan-statement",
      "GET /api/topup-range/:nrc",
      "POST /api/topup-range",
      "GET /api/wallet-balance/:nrc",
      "POST /api/wallet-balance",
      "GET /api/bank-details",
      "POST /api/ussd-payment",
      "POST /webhook"
    ],
    lupiya_config: { baseUrl: process.env.LUPIYA_BASE_URL || 'https://backend.qa.lupiya.com', hasToken: !!process.env.LUPIYA_ACCESS_TOKEN }
  });
});

const apiRouter = express.Router();
// Add other apiRouter routes (topup-range, loan-statement, etc.) as previously provided

// Bank Details GET (already working)
// Bank Details GET
apiRouter.get('/bank-details', async (req, res) => {
  try {
    const result = await LupiyaService.getBankDetails();
    const accountName = result.data[0].accountName; // Assuming same account name for all
    const message = `🏦 *Bank Repayment Details for ${accountName}*\n\n` +
      result.data.map(bank => 
        `💳 *${bank.bankName}*\n` +
        `  - Account Number: ${bank.bankAccountNumber}\n` +
        `  - Branch: ${bank.bankBranch}\n` +
        `  - Branch Code: ${bank.branchCode || 'Not available'}\n\n`
      ).join('');
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
      const maxValue = result.amountRange.max;
      const maxRounded = typeof maxValue === 'number' ? maxValue.toFixed(2) : maxValue; // Safe rounding
      const message = `💰 *Loan Topup Available for ${nrc}*\n\n` +
        `Loan Type: ${result.loanType}\n` +
        `Minimum: ZMW ${result.amountRange.min}\n` +
        `Maximum: ZMW ${maxRounded}\n` +
        `📌 *Note:* Please keep your top-up amount between ZMW 0 and ${maxRounded}!`;
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

// Loan Statement GET
apiRouter.post('/loan-statement/:nrc', async (req, res) => {
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

app.use('/api', apiRouter);
app.use('/webhook', lupiyaEndpoints);
app.post('/webhook', (req, res) => res.sendStatus(200));
app.use((req, res) => {
  console.log(`404: Route not found for ${req.url}`);
  res.status(404).json({ error: "Route not found", url: req.url });
});

console.log(`Starting server on port ${PORT}...`);
app.listen(PORT, () => console.log(`Server is listening on port: ${PORT}`));

function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn("App Secret is not set up. Please add your app secret in /.env file to check for request validation");
    return true;
  }
  const signatureHeader = req.get("x-hub-signature-256");
  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");
  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest('hex');
  const digestBuffer = Buffer.from(digestString, "utf-8");
  if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match");
    return false;
  }
  return true;
}