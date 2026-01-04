  require('dotenv').config();
const express = require('express');
const { DateTime } = require('luxon');
const { paymentMiddleware } = require('@x402/express');
const { facilitator } = require('@coinbase/cdp-sdk'); // For CDP integration

const app = express();
const port = process.env.PORT || 3000;

// Configure x402 with CDP facilitator
const x402Config = {
  facilitatorUrl: process.env.FACILITATOR_URL,
  chainId: parseInt(process.env.CHAIN_ID),
};

// Payment options for the endpoint
const paymentOptions = {
  amount: 0.0005, // Micro-fee in USDC
  token: 'USDC',
  chain: 'base', // Or 'solana' if preferred
  recipient: process.env.RECIPIENT_ADDRESS,
  // Discovery metadata for Bazaar registration
  metadata: {
    name: 'Timezone Conversion API',
    description: 'Converts timestamps between timezones with DST and historical accuracy.',
    category: 'utilities/time',
    schema: {
      input: {
        from: 'string (e.g., UTC)',
        to: 'string (e.g., America/New_York)',
        time: 'ISO string (e.g., 2026-01-04T12:00:00)'
      },
      output: {
        converted: 'ISO string'
      }
    },
    limits: { rate: '1000/min' },
    discoverable: true // Opt-in to Bazaar listing
  }
};

// Enable JSON parsing for requests
app.use(express.json());

// Health check (free endpoint)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

// Protected timezone conversion endpoint
app.get('/convert', paymentMiddleware(paymentOptions, x402Config), (req, res) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    return res.status(400).json({ error: 'Missing parameters: from, to, time' });
  }

  try {
    const original = DateTime.fromISO(time, { zone: from });
    if (!original.isValid) {
      return res.status(400).json({ error: 'Invalid time or from timezone' });
    }

    const converted = original.setZone(to);
    if (!converted.isValid) {
      return res.status(400).json({ error: 'Invalid to timezone' });
    }

    res.json({
      original: original.toISO(),
      converted: converted.toISO(),
      fromTimezone: from,
      toTimezone: to
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server with Bazaar registration
app.listen(port, async () => {
  console.log(`API running on http://localhost:${port}`);

  // Register with Bazaar via CDP facilitator (runs on startup)
  try {
    const client = facilitator({ url: x402Config.facilitatorUrl });
    await client.registerResource('/convert', paymentOptions.metadata);
    console.log('API registered in x402 Bazaar!');
  } catch (error) {
    console.error('Bazaar registration failed:', error);
  }
});