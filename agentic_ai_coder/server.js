const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint to generate code via NVIDIA NIM
app.post('/api/generate', async (req, res) => {
  const { prompt, max_tokens = 256 } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }
  try {
    const response = await fetch(process.env.NIM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nemotron-3-ultra-550b-a55b',
        prompt,
        max_tokens,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      })
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`NIM API error: ${response.status} ${err}`);
    }
    const data = await response.json();
    res.json({ result: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Agentic AI Coder server listening on port ${PORT}`);
});
