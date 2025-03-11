require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require('puppeteer');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 4000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(bodyParser.text({ type: "text/plain", limit: "50mb" }));

// Function to check token
const checkToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (token === SECURE_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
};

// Get Endpoint
app.get("/", (req, res) => {
    res.send("Uplifted Render Server Up and running");
});

// Execute endpoint
app.post("/execute", checkToken, async (req, res) => {
    const code = req.body;
    if (!code) {
        return res.status(400).json({ error: "No code provided" });
    }

    let browser;
    try {
        // Launch browser with timeout and resource constraints
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 60000 // 60 seconds timeout for launching the browser
        });

        // Open new page
        const page = await browser.newPage();

        // Set default timeouts for navigation and waiting
        const TIMEOUT = 60000; // 60 seconds
        page.setDefaultNavigationTimeout(TIMEOUT);
        page.setDefaultTimeout(TIMEOUT);

        // Create a function with puppeteer, browser, page, and console in its scope
        const asyncFunction = new Function('puppeteer', 'browser', 'page', 'console', `
            return (async () => {
                ${code}
            })();
        `);

        // Execute and await the result
        const result = await asyncFunction(puppeteer, browser, page, console);
        
        // Close browser
        await browser.close();

        // Return the result
        res.json({ result });
    } catch (error) {
        // Ensure browser is closed in case of an error
        if (browser) await browser.close();
        res.status(500).json({ error: error.message, trace: error.stack });
    }
});

// Generate keywords endpoint
app.post("/generate-keywords", checkToken, async (req, res) => {
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