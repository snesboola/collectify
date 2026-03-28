const axios = require('axios');
const storage = require('./storage');

// bare minimum auth flow for spotify api
const SCOPES = [
    'user-read-playback-state',
    'user-read-currently-playing',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
].join(' ');

const AUTH_HEADER = 'Basic ' + Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
).toString('base64');

function getLoginUrl() {
    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.REDIRECT_URI,
      scope: SCOPES,
    });
    return `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code) {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: AUTH_HEADER,
        },
      }
    );
    return res.data;
}

// get new token if expired 
async function refreshAccessToken(userId, refreshToken) {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: AUTH_HEADER,
        },
      }
    );
    const newToken = res.data.access_token;
    await storage.updateUserToken(userId, newToken);
    return newToken;
}
