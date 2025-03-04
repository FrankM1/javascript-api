require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 4000;
const SECURE_TOKEN = process.env.SECURE_TOKEN;
const TIMEOUT = 60000; // 60 seconds timeout

// Middleware
app.use(bodyParser.text({ 
  type: "text/plain", 
  limit: "50mb" 
}));

// Token validation middleware
const checkToken = (req, res, next) => {
  if (req.headers.authorization === SECURE_TOKEN) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

// Browser launch options
const browserOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  timeout: TIMEOUT
};

// Health check endpoint
app.get("/", (_, res) => {
  res.send("Uplifted Render Server Up and running");
});

// Execute code endpoint
app.post("/execute", checkToken, async (req, res) => {
  const code = req.body?.trim();
  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  let browser;
  try {
    browser = await puppeteer.launch(browserOptions);
    const page = await browser.newPage();
    
    page.setDefaultNavigationTimeout(TIMEOUT);
    page.setDefaultTimeout(TIMEOUT);

    // Execute code in isolated context
    const asyncFunction = new Function(
      'puppeteer', 
      'browser', 
      'page', 
      'console',
      `try {
        ${code}
      } catch (err) {
        console.error('Code execution error:', err);
        throw err;
      }`
    );

    const result = await Function(puppeteer, browser, page, console);
    await browser.close();
    res.json({ result });

  } catch (error) {
    if (browser) await browser.close();
    res.status(500).json({ 
      error: error.message, 
      trace: error.stack 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});