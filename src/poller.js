const axios = require("axios");
const detector = require("./detector");
const playlists = require("./playlists");
const { refreshAccessToken } = require("./auth");
const storage = require("./storage");

const activePollers = {};

function getInterval(trackState) {
  if (!trackState) return 30000;

  const progress = trackState.progress / trackState.duration;
  const timeLeft = trackState.duration - trackState.progress;

  if (progress > 0.8) return 2000;
  if (timeLeft < 30000) return 2000;
  if (trackState.duration < 60000) return 3000;
  if (progress > 0.5) return 10000;
  return 30000;
}

async function poll(userId) {
  if (!activePollers[userId]) return;

  const user = await storage.getUser(userId);
  if (!user) return;

  let trackState = null;

  try {
    const res = await axios.get(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: `Bearer ${user.access_token}` },
        validateStatus: (s) => s < 500,
      }
    );

    // Handle expired token
    if (res.status === 401) {
      console.log(`[${userId}] Token expired, refreshing...`);
      if (user.refresh_token) {
        await refreshAccessToken(userId, user.refresh_token);
      }
    } else {
      const current = res.status === 200 ? res.data : null;
      const fullListen = detector.update(userId, current);
      trackState = detector.getState(userId);

      if (fullListen) {
        const freshUser = await storage.getUser(userId);
        const playlistId = await playlists.getPlaylistId(
          userId,
          freshUser.access_token,
          freshUser.mode,
          fullListen
        );
        await playlists.addTrack(
          freshUser.access_token,
          playlistId,
          fullListen.uri
        );
        console.log(
          `[${userId}] Full listen: "${fullListen.name}" → playlist ${playlistId}`
        );
      }
    }
  } catch (err) {
    console.error(`[${userId}] Poll error:`, err.message);
  }

  const interval = getInterval(trackState);
  activePollers[userId] = setTimeout(() => poll(userId), interval);
}

function startPolling(userId) {
  if (activePollers[userId]) return;
  console.log(`[${userId}] Polling started`);
  activePollers[userId] = true;
  poll(userId);
}

function stopPolling(userId) {
  if (activePollers[userId]) {
    clearTimeout(activePollers[userId]);
    delete activePollers[userId];
    console.log(`[${userId}] Polling stopped`);
  }
}

module.exports = { startPolling, stopPolling };
