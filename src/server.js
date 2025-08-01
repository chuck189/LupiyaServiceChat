// server.js
import express from 'express';
import { LupiyaService } from './lupiyaep.js'; // Ensure this path matches your project structure

const app = express();
app.use(express.json());

const apiRouter = express.Router();

// Loan Statement Endpoint
apiRouter.post('/loan-statement', async (req, res) => {
  try {
    console.log("Received loan-statement request:", req.body);
    const { nrc } = req.body;
    if (!nrc) {
      console.log("Missing NRC in request body");
      return res.status(400).json({
        success: false,
        message: '❌ NRC number is required'
      });
    }
    console.log("Processing loan statement for NRC:", nrc);
    const result = await LupiyaService.getLoanStatement(nrc);
    console.log("Loan Statement Result:", result);
    let message = `Loan Statement for ${nrc}\n`;
    let statementItems = [];
    if (Array.isArray(result.data)) {
      statementItems = result.data;
    } else if (result.data && typeof result.data === 'object') {
      statementItems = [result.data];
    } else {
      statementItems = [];
    }
    if (statementItems.length === 0) {
      message += 'No loan statement data available.';
    } else {
      message += statementItems.map(item =>
        `- Date: ${new Date(item.loanStartDate).toLocaleDateString()}\n` +
        `- Loan Type: ${item.loanType || 'N/A'}\n` +
        `- Amount Paid: ZMW ${Number(item.totalPaymentsMade || 0).toFixed(2)}\n` +
        `- Outstanding Balance: ZMW ${Number(item.outstandingBalance || 0).toFixed(1)}`
      ).join('\n');
    }
    res.json({
      success: true,
      message,
      data: statementItems
    });
  } catch (error) {
    console.error("Error in /loan-statement:", error.message);
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Verify Customer Account Endpoint
apiRouter.get('/verify-customer-account', async (req, res) => {
  try {
    console.log("Received verify-customer-account request:", req.query);
    const { idNumber } = req.query;
    if (!idNumber) {
      console.log("Missing idNumber in query parameters");
      return res.status(400).json({
        success: false,
        message: '❌ idNumber is required'
      });
    }
    console.log("Verifying customer account for idNumber:", idNumber);
    const result = await LupiyaService.verifyCustomerAccount(idNumber);
    console.log("Verification Result:", result);
    if (result.verified) {
      res.json({
        success: true,
        message: result.message || 'Customer account verified successfully.',
        verified: true
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message || 'Customer account not found.',
        verified: false
      });
    }
  } catch (error) {
    console.error("Error in /verify-customer-account:", error.message);
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Loan Topup Range Endpoint
apiRouter.post('/loan-topup-range', async (req, res) => {
  try {
    console.log("Received loan-topup-range request:", req.body);
    const { idNumber } = req.body;
    if (!idNumber) {
      console.log("Missing idNumber in request body");
      return res.status(400).json({
        success: false,
        message: '❌ idNumber is required'
      });
    }
    console.log("Verifying customer for topup range with idNumber:", idNumber);
    const verification = await LupiyaService.verifyCustomerAccount(idNumber);
    if (!verification.verified) {
      console.log("Customer verification failed for idNumber:", idNumber);
      return res.status(404).json({
        success: false,
        message: '❌ Customer not verified. Topup range unavailable.'
      });
    }
    console.log("Customer verified, fetching topup range for idNumber:", idNumber);
    const result = await LupiyaService.getLoanTopupRange(idNumber);
    console.log("Loan Topup Range Result:", result);
    let message = `📊 *Topup Range for ${idNumber}*\n`;
    let topupItems = [];
    if (Array.isArray(result.data)) {
      topupItems = result.data;
    } else if (result.data && typeof result.data === 'object') {
      topupItems = [result.data];
    } else {
      topupItems = [];
    }
    if (topupItems.length === 0) {
      message += 'No topup range data available.';
    } else {
      message += topupItems.map(item =>
        `Minimum Topup: ZMW ${Number(item.minTopup || 0).toFixed(2)}\n` +
        `Maximum Topup: ZMW ${Number(item.maxTopup || 0).toFixed(2)}\n` +
        'Note: Please stay within this range.'
      ).join('\n---\n\n');
    }
    res.json({
      success: true,
      message,
      data: topupItems
    });
  } catch (error) {
    console.error("Error in /loan-topup-range:", error.message);
    res.status(500).json({
      success: false,
      message: `❌ Error: ${error.message}`
    });
  }
});

// Email Endpoint (unchanged)
apiRouter.post('/send-email', async (req, res) => {
  const { message } = req.body;
  try {
    await transporter.sendMail({
      from: SMTP_EMAIL,
      to: SMTP_RECIPIENT,
      subject: 'Fraud Report',
      text: message
    });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

// Health Check Endpoint (unchanged)
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api', apiRouter);

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  loadToken(); // Ensure token is loaded on startup
});