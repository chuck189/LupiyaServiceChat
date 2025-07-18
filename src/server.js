import express from "express";
import { decryptRequest, encryptResponse, FlowEndpointException } from "./encryption.js";
import { getNextScreen } from "./flow.js";
import crypto from "crypto";
import { default as lupiyaEndpoints, LupiyaService } from "./lupiyaep.js";
const app = express();

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);

const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "", PORT = "3000" } = process.env;

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
    const message = `💰 *Loan Topup Available for ${nrc}*\n\n` +
      `Loan Type: ${result.loanType}\n` +
      `Minimum: ZMW ${result.amountRange.min}\n` +
      `Maximum: ZMW ${result.amountRange.max}`;
     // `📌 *Note:* Please keep your top-up amount between ZMW 0 and ${maxRounded}!`;
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