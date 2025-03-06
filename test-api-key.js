#!/usr/bin/env node

import axios from "axios";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Load .env file from the project root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

// Get the API key from command line arguments or .env file
let apiKey = process.argv[2];

// If no API key is provided as a command line argument, try to get it from the .env file
if (!apiKey) {
  apiKey = process.env.EVENTBRITE_API_KEY || process.env.EVENTBRITEAPIKEY;

  if (!apiKey) {
    console.error("Error: EVENTBRITE_API_KEY environment variable is required");
    console.error("");
    console.error("To use this tool, run it with your Eventbrite API key:");
    console.error("node test-api-key.js YOUR_API_KEY");
    console.error("");
    console.error("Or set it in your environment:");
    console.error("export EVENTBRITE_API_KEY=your-api-key");
    console.error("node test-api-key.js");
    console.error("");
    console.error("Or create a .env file with EVENTBRITE_API_KEY=your-api-key");
    process.exit(1);
  } else {
    console.log("Using API key from .env file");
  }
}

// Create an Axios instance with the API key
const client = axios.create({
  baseURL: "https://www.eventbriteapi.com/v3",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

// Test the API key by fetching categories (a simple, public endpoint)
async function testApiKey() {
  try {
    console.log("Testing Eventbrite API key...");

    const response = await client.get("/categories/");

    console.log("✅ API key is valid!");
    console.log(`Found ${response.data.categories.length} categories`);

    // Print the first few categories as a sample
    console.log("\nSample categories:");
    response.data.categories.slice(0, 5).forEach((category) => {
      console.log(`- ${category.name} (ID: ${category.id})`);
    });

    console.log("\nYou can now configure the MCP server with this API key.");
  } catch (error) {
    console.error("❌ Error testing API key:");

    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(
          `Message: ${error.response.data.error_description || error.message}`
        );
      } else {
        console.error(`Message: ${error.message}`);
      }

      if (error.response && error.response.status === 401) {
        console.error("\nYour API key appears to be invalid or has expired.");
        console.error("Please check your API key and try again.");
      }
    } else {
      console.error(`Unexpected error: ${error}`);
    }

    process.exit(1);
  }
}

testApiKey();
