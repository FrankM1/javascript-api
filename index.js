require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require('puppeteer');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 4000;
const SECURE_TOKEN = process.env.SECURE_TOKEN;
const TIMEOUT = 60000; // 60 seconds timeout

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

// Apply token check to all routes except health check
app.use((req, res, next) => {
  if (req.path === '/') {
    return next();
  }
  checkToken(req, res, next);
});

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
app.post("/execute", async (req, res) => {

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

    const result = await asyncFunction(puppeteer, browser, page, console);
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

// Generate keywords endpoint
app.post("/generate-keywords", async (req, res) => {
    const text = req.body;
    if (!text) {
        return res.status(400).json({ error: "No text provided" });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a keyword extraction specialist. Extract relevant keywords from the given text and return them as a comma-separated list. Focus on important terms, topics, and themes."
                },
                {
                    role: "user",
                    content: `Extract keywords from this text: ${text}`
                }
            ],
            temperature: 0.3,
        });

        const keywords = completion.choices[0].message.content
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0);

        res.json({ keywords });
    } catch (error) {
        res.status(500).json({ 
            error: "Failed to generate keywords",
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});