const axios = require('axios');
const detector = require('./detector');
console.log('detector loaded:', detector);
const playlists = require('./playlists');
const { refreshAccessToken } = require('./auth');
const storage = require('./storage');

const activePollers = {};
const POLL_INTERVAL_MS = 5000;

async function poll(userId) {
    const user = await storage.getUser(userId);
    if (!user) return;
  
    try {
      console.log(`[${userId}] Polling with token: ${user.access_token.slice(0, 20)}...`);  
      const res = await axios.get(
        'https://api.spotify.com/v1/me/player/currently-playing',
        {
          headers: { Authorization: `Bearer ${user.access_token}` },
          validateStatus: (s) => s < 500,
        }
      );
      console.log(`[${userId}] Spotify response status: ${res.status}`);
      const current = res.status === 200 ? res.data : null;
    const fullListen = detector.update(userId, current);

    if (fullListen) {
      const freshUser = await storage.getUser(userId);
      const playlistId = await playlists.getPlaylistId(
        userId,
        freshUser.access_token,
        freshUser.mode,
        fullListen
      );
      await playlists.addTrack(freshUser.access_token, playlistId, fullListen.uri);
      console.log(
        `[${userId}] Full listen: "${fullListen.name}" → playlist ${playlistId}`
      );
    }
  } catch (err) {
    if (err.response?.status === 401) {
        console.log(`[${userId}] Token expired, refreshing...`);
        const user = await storage.getUser(userId);
    if (user?.refresh_token) {
        await refreshAccessToken(userId, user.refresh_token);
      }
    } else {
        console.error(`[${userId}] Full error:`, err.response?.data);
        console.error(`[${userId}] Poll error:`, err.message);
    }
  }
}
    
function startPolling(userId) {
    if (activePollers[userId]) return;
    console.log(`[${userId}] Polling started`);
    activePollers[userId] = setInterval(() => poll(userId), POLL_INTERVAL_MS);
  }
  
function stopPolling(userId) {
    if (activePollers[userId]) {
      clearInterval(activePollers[userId]);
      delete activePollers[userId];
      console.log(`[${userId}] Polling stopped`);
    }
  }
  
module.exports = { startPolling, stopPolling };
    