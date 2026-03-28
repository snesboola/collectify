const trackStates = {};

function update(userId, current) {
    if (!current || !current.item) {
      trackStates[userId] = null;
      return null;
    }

    const { item, progress_ms } = current;
    const trackId = item.id;
    const duration = item.duration_ms;
    const prev = trackStates[userId];

    if (!prev || prev.trackId !== trackId) {
        trackStates[userId] = { trackId, duration, qualified: false };
        return null;
    }

    //don't add song twice
    if (prev.qualified) return null;

    // criteria is the user has listened to 90% of the song
    const progress = progress_ms / duration;
    if (progress >= 0.9) {
        trackStates[userId].qualified = true;
        return item;
    }

    return null;

}

module.exports = { update };