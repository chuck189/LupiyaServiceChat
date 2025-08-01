// lupiyaep.js
import axios from 'axios';
import nodemailer from 'nodemailer';
import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const LUPIYA_CONFIG = {
  baseUrl: process.env.LUPIYA_BASE_URL || 'https://backend.qa.lupiya.com'
};
console.log("Lupiya API Base URL:", LUPIYA_CONFIG.baseUrl);

const TOKEN_FILE = path.join('/tmp', 'lupiya_token.json');
const { SMTP_EMAIL, SMTP_PASSWORD, SMTP_RECIPIENT, SMTP_HOST = "mail.d2ctelcare.com", SMTP_PORT = "465" } = process.env;

console.log("Lupiyaep Environment Variables:", { SMTP_EMAIL, SMTP_PASSWORD, SMTP_RECIPIENT, SMTP_HOST, SMTP_PORT });

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT),
  secure: parseInt(SMTP_PORT) === 465,
  auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD }
});

let currentToken = null;
let tokenExpiry = null;

function loadToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      currentToken = data.token;
      tokenExpiry = new Date(data.created);
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + data.ttl);
      console.log("Loaded token from file, expires at:", tokenExpiry);
    } else {
      console.log("No token file found, triggering renewal...");
      renewToken();
    }
  } catch (error) {
    console.error("Error loading token from file:", error.message);
    renewToken();
  }
}

function saveToken(token, expiry, created = new Date().toISOString(), ttl = 86400) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiry: expiry.toISOString(), created, ttl }), 'utf8');
    console.log("Token saved to file:", TOKEN_FILE);
  } catch (error) {
    console.error("Failed to save token to file:", error.message);
  }
}

async function renewToken() {
  try {
    const credentials = {
      email: process.env.LUPIYA_EMAIL || "whatsapp-chatbot-service-account@lupiya.com",
      password: process.env.LUPIYA_PASSWORD || "Is%2&tcFh2PvI3lG"
    };
    console.log("Attempting token renewal with email:", credentials.email);
    const response = await axios.post(
      `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/token`,
      credentials,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log("Token API Response:", response.data);
    const token = response.data.token || response.data.access_token || response.data.jwt;
    if (!token) {
      throw new Error("No valid token found in API response");
    }
    if (token.split('.').length !== 3) {
      console.warn("Token does not appear to be a valid JWT:", token);
    }
    const created = response.data.created || new Date().toISOString();
    const ttl = response.data.ttl || 86400;
    currentToken = token;
    tokenExpiry = new Date(created);
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + ttl);
    saveToken(currentToken, tokenExpiry, created, ttl);
    console.log("Token renewed successfully, expires at:", tokenExpiry);
  } catch (error) {
    console.error("Token renewal failed:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error('Token renewal failed');
  }
}

async function getAccessToken(forceRenew = false) {
  if (forceRenew || !currentToken || (tokenExpiry && tokenExpiry <= new Date())) {
    console.log("Token missing, expired, or forced renewal, renewing...");
    await renewToken();
  }
  if (!currentToken) {
    throw new Error("No valid token available after renewal attempt");
  }
  return currentToken;
}

class LupiyaService {
  static async getLoanStatement(idNumber) {
    try {
      const token = await getAccessToken();
      console.log("Sending loan statement request with token:", token.substring(0, 10) + "...");
      const response = await axios.post(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/loan-statement`,
        { idNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token
          }
        }
      );
      console.log("Loan Statement API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching loan statement:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error('Failed to fetch loan statement');
    }
  }

  static async verifyCustomerAccount(idNumber) {
    try {
      const token = await getAccessToken();
      console.log("Sending customer verification request with token:", token.substring(0, 10) + "...");
      const response = await axios.get(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/verify-customer-account`,
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token
          },
          params: { idNumber }
        }
      );
      console.log("Customer Verification API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error verifying customer account:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error('Failed to verify customer account');
    }
  }

  static async getLoanTopupRange(idNumber) {
    try {
      const token = await getAccessToken();
      console.log("Sending loan topup range request with token:", token.substring(0, 10) + "...");
      const response = await axios.post(
        `${LUPIYA_CONFIG.baseUrl}/api/v1/services/messaging/whatsapp/loan-topup-range`,
        { idNumber },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': token
          }
        }
      );
      console.log("Loan Topup Range API Response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching loan topup range:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error('Failed to fetch loan topup range');
    }
  }
}

app.post('/send-email', async (req, res) => {
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

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

export { app as default, LupiyaService };