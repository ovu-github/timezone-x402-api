require('dotenv').config();
const express = require('express');
const { DateTime } = require('luxon');
const { paymentMiddleware } = require('@x402/express'); // Only this for x402

const app = express();
const port = process.env.PORT || 3000;

// Payment options – no facilitator or registration needed
const paymentOptions = {
  amount: 0.0005, // USDC
  token: 'USDC',
  chain: 'base',
  recipient: process.env.RECIPIENT_ADDRESS, // Required env var
  // Optional metadata for future discovery (not auto-registered)
  metadata: {
    name: 'Timezone Conversion API',
    description: 'Accurate timezone conversions with DST support.',
    category: 'utilities/time',
    discoverable: true
  }
};

app.use(express.json());

// Free health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Timezone x402 API is running!' });
});

// Paid convert endpoint
app.get('/convert', paymentMiddleware(paymentOptions), (req, res) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    return res.status(400).json({ error: 'Missing parameters: from, to, time required' });
  }

  try {
    const original = DateTime.fromISO(time, { zone: from });
    if (!original.isValid) return res.status(400).json({ error: 'Invalid time or from timezone' });

    const converted = original.setZone(to);
    if (!converted.isValid) return res.status(400).json({ error: 'Invalid to timezone' });

    res.json({
      original: original.toISO(),
      fromTimezone: from,
      converted: converted.toISO(),
      toTimezone: to
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

// Vercel serverless export
module.exports = app; // Critical for Vercel!

// Local dev only
if (require.main === module) {
  app.listen(port, () => console.log(`API running on port ${port}`));
}