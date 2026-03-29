// Using pool app keeps database connectiions open instead of opening a fresh connection every 5s for polling.
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// add a table for users and playlists if they don't exist
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    mode TEXT DEFAULT 'alltime',
    session_playlist_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
`);

  // track playlist ids
  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
    user_id TEXT,
    key TEXT,
    playlist_id TEXT,
    PRIMARY KEY (user_id, key)
    )
`);

  console.log("Database ready");
}

// $1 prevents sql injection.
async function getUser(userId) {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  return res.rows[0] || null;
}

async function getAllUsers() {
  const res = await pool.query("SELECT * FROM users");
  return res.rows;
}

async function upsertUser(id, accessToken, refreshToken) {
  await pool.query(
    `INSERT INTO users (id, access_token, refresh_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
       SET access_token = $2, refresh_token = $3`,
    [id, accessToken, refreshToken]
  );
}

async function updateUserToken(userId, accessToken) {
  await pool.query("UPDATE users SET access_token = $1 WHERE id = $2", [
    accessToken,
    userId,
  ]);
}

async function updateUserMode(userId, mode) {
  await pool.query(
    "UPDATE users SET mode = $1, session_playlist_id = NULL WHERE id = $2",
    [mode, userId]
  );
}

//remove old playlist from db when user changes mode.
async function updateSessionPlaylist(userId, playlistId) {
  await pool.query("UPDATE users SET session_playlist_id = $1 WHERE id = $2", [
    playlistId,
    userId,
  ]);
}

// create playlists

async function getPlaylist(userId, key) {
  const res = await pool.query(
    "SELECT playlist_id FROM playlists WHERE user_id = $1 AND key = $2",
    [userId, key]
  );
  return res.rows[0]?.playlist_id || null;
}

async function savePlaylist(userId, key, playlistId) {
  await pool.query(
    `INSERT INTO playlists (user_id, key, playlist_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO NOTHING`,
    [userId, key, playlistId]
  );
}

module.exports = {
  init,
  getUser,
  getAllUsers,
  upsertUser,
  updateUserToken,
  updateUserMode,
  updateSessionPlaylist,
  getPlaylist,
  savePlaylist,
};
