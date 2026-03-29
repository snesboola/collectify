require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const { getLoginUrl, exchangeCode } = require('./auth');
const { startPolling } = require('./poller');
const storage = require('./storage');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));


// ── Routes ───────────────────────────────────────────────

app.get('/login', (req, res) => {
    res.redirect(getLoginUrl());
  });

app.get('/callback', async (req, res) => {
try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const tokens = await exchangeCode(code);

    const profile = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userId = profile.data.id;

    await storage.upsertUser(userId, tokens.access_token, tokens.refresh_token);
    startPolling(userId);

    res.redirect(`/settings.html?user=${encodeURIComponent(userId)}`);
} catch (err) {
    console.error('Callback error:', err.message);
    res.status(500).send('Authentication failed. Please try again.');
}
});

app.get('/api/settings', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ mode: user.mode });
  });
  
app.post('/api/settings', async (req, res) => {
    const { userId, mode } = req.body;
    const validModes = ['alltime', 'daily', 'session', 'genre'];
    if (!userId || !validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid userId or mode' });
    }
    await storage.updateUserMode(userId, mode);
    res.json({ ok: true, mode });
  });

// ── Start ────────────────────────────────────────────────

async function start() {
    await storage.init();
  
    const users = await storage.getAllUsers();
    users.forEach((u) => startPolling(u.id));
    console.log(`Resumed polling for ${users.length} existing user(s)`);
  
    const PORT = process.env.PORT || 8888;
    app.listen(PORT, () => {
      console.log(`Collectify running on port ${PORT}`);
    });
  }
  
start().catch(console.error);