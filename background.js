let currentLyrics = [];
let lastFetchedTrack = "";

function parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const lyrics = [];
    const regex = /\[(\d{2}):(\d{2})[\.,](\d{2,3})\]/g;

    for (const line of lines) {
        const matches = [...line.matchAll(regex)];
        const text = line.replace(regex, '').trim();
        if (matches.length && text) {
            for (const match of matches) {
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                const ms = parseInt(match[3].padEnd(3, '0'), 10);
                lyrics.push({ time: min * 60 + sec + ms / 1000, text });
            }
        }
    }
    return lyrics.sort((firstLine, secondLine) => firstLine.time - secondLine.time);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetch_lyrics") {
        const { title, artist, album, duration } = request.data;
        const trackId = `${title}-${artist}`;

        if (trackId === lastFetchedTrack && currentLyrics.length > 0) {
            sendResponse({ status: "cached", lyrics: currentLyrics });
            return true;
        }

        const requestedTrack = trackId;
        lastFetchedTrack = requestedTrack;
        currentLyrics = [];
        const params = new URLSearchParams({
            track_name: title,
            artist_name: artist
        });
        if (album) params.set('album_name', album);
        if (Number.isFinite(duration) && duration > 0) params.set('duration', String(Math.round(duration)));
        const getUrl = `https://lrclib.net/api/get?${params}`;
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const fetchJson = url => fetch(url).then(response => {
            if (!response.ok) throw new Error(`LRCLIB request failed: ${response.status}`);
            return response.json();
        });
        const findSyncedCandidate = results => {
            if (!Array.isArray(results)) return null;
            return results
                .filter(item => item && item.syncedLyrics)
                .sort((first, second) => Math.abs((first.duration || 0) - (duration || 0)) - Math.abs((second.duration || 0) - (duration || 0)))[0] || null;
        };
        
        fetchJson(getUrl)
            .catch(() => fetchJson(searchUrl).then(findSyncedCandidate))
            .then(result => {
                if (result) {
                    if (lastFetchedTrack !== requestedTrack) {
                        sendResponse({ status: "stale", lyrics: [] });
                        return;
                    }
                    currentLyrics = parseLRC(result.syncedLyrics);
                    sendResponse({ status: "success", lyrics: currentLyrics });
                } else {
                    if (lastFetchedTrack !== requestedTrack) {
                        sendResponse({ status: "stale", lyrics: [] });
                        return;
                    }
                    currentLyrics = [];
                    sendResponse({ status: "no_synced_lyrics", lyrics: [] });
                }
            })
            .catch(err => {
                console.error("Error fetching lyrics: - background.js:49", err);
                sendResponse({ status: "error", lyrics: [] });
            });
            
        return true;
    }
});