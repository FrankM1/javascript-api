require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 4000;

// Secure token from environment variable
const SECURE_TOKEN = process.env.SECURE_TOKEN;

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
app.get("/", (req,res) => {
    res.send("Uplifted Render Server Up and running")
})

// Execute endpoint
app.post("/execute", checkToken, async (req, res) => {
    const code = req.body;
    if (!code) {
        return res.status(400).json({ error: "No code provided" });
    }

    try {
        // Create a function with puppeteer in its scope
        const asyncFunction = new Function('puppeteer', `
            return (async () => {
                ${code}
            })();
        `);

        // Execute and await the result, passing puppeteer as an argument
        const result = await asyncFunction(puppeteer);
        
        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message, trace: error.stack });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});