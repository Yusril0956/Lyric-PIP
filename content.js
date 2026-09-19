// 1. Suntikkan script ke "Main World" agar bisa akses window.documentPictureInPicture
function injectMainWorldScript() {
    if (document.getElementById('main-world-pip-script')) return;
    const script = document.createElement('script');
    script.id = 'main-world-pip-script';
    script.src = chrome.runtime.getURL('main-world.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
}

// 2. Tombol UI di halaman Spotify
function injectButton() {
    if (document.getElementById('pip-lyrics-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'pip-lyrics-btn';
    btn.innerText = 'Show PiP Lyrics';
    btn.style.cssText = `
        position: fixed; bottom: 100px; right: 20px; z-index: 9999;
        background: #1DB954; color: white; border: none; padding: 12px 20px;
        border-radius: 25px; font-weight: bold; cursor: pointer; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-family: sans-serif;
    `;
    
    btn.onclick = () => {
        btn.innerText = 'Loading...';
    };
    
    document.body.appendChild(btn);
}

// 3. Dengarkan balasan dari Main World (apakah PiP berhasil dibuka)
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'PIP_OPENED') {
        const btn = document.getElementById('pip-lyrics-btn');
        if (btn) {
            btn.innerText = '✅ PiP Active';
            btn.style.background = '#555';
        }
    } else if (event.data.type === 'PIP_ERROR') {
        alert(`Gagal membuka PiP: ${event.data.message}`);
        const btn = document.getElementById('pip-lyrics-btn');
        if (btn) btn.innerText = 'Show PiP Lyrics';
    }
});

// 4. Ambil data lagu dan waktu dari Spotify
function getSpotifyState() {
    const { title, artist, album } = getTrackMetadata();

    const audioElements = [...document.querySelectorAll('audio')];
    const playingAudio = audioElements.find(audio => !audio.paused && audio.readyState > 0);
    if (playingAudio) cachedSpotifyAudio = playingAudio;
    if (!cachedSpotifyAudio || !audioElements.includes(cachedSpotifyAudio)) {
        cachedSpotifyAudio = audioElements
            .filter(audio => Number.isFinite(audio.currentTime) && Number.isFinite(audio.duration) && audio.duration > 0)
            .sort((firstAudio, secondAudio) => secondAudio.duration - firstAudio.duration)[0] || null;
    }
    const audio = cachedSpotifyAudio;
    const timeEl = document.querySelector('[data-testid="playback-position"], [data-testid="playback-time"]');
    const durationEl = document.querySelector('[data-testid="playback-duration"], [data-testid="playback-duration-label"]');
    const visibleTime = parseClock(timeEl ? timeEl.innerText : '');
    const visibleDuration = parseClock(durationEl ? durationEl.innerText : '');
    const mediaTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const rawTime = playingAudio && Number.isFinite(mediaTime)
        ? mediaTime
        : visibleTime || mediaTime;
    const paused = getSpotifyPaused(audio, playingAudio);
    const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : visibleDuration;
    const trackKey = `${title}-${artist}`;
    if (clockSample.trackKey !== trackKey || clockSample.paused !== paused) {
        clockSample = { trackKey, time: rawTime, wallTime: performance.now(), paused };
    } else if (Math.abs(rawTime - clockSample.time) >= 1) {
        clockSample = { trackKey, time: rawTime, wallTime: performance.now(), paused: clockSample.paused };
    }
    const currentTime = clockSample.paused
        ? clockSample.time
        : clockSample.time + (performance.now() - clockSample.wallTime) / 1000;

    return {
        title,
        artist,
        album,
        trackKey: `${title}::${artist}`,
        currentTime,
        duration,
        paused,
        volume: audio && Number.isFinite(audio.volume) ? audio.volume : 1,
        muted: audio ? audio.muted : false,
        hasPlayback: Number.isFinite(currentTime) && Number.isFinite(duration)
    };
}

function getTrackMetadata() {
    const clean = value => (value || '').replace(/\s+/g, ' ').trim();
    const titleText = clean(document.title.replace(/\s*[|\-]\s*Spotify\s*$/i, ''));
    let title = '';
    let artist = '';
    let album = '';
    const titleParts = titleText.split(/\s+[•|]\s+|\s+-\s+/).map(clean).filter(Boolean);
    if (titleParts.length >= 2) {
        title = titleParts[0];
        artist = titleParts.slice(1).join(' ');
    }

    const selectors = [
        '[data-testid="context-item-link"]',
        '[data-testid="now-playing-widget"]',
        '[data-testid="now-playing-bar"]',
        '[data-testid="now-playing-widget"] a',
        'footer a[href^="/track/"]'
    ];
    const elements = selectors.flatMap(selector => [...document.querySelectorAll(selector)]);
    const textCandidates = elements.flatMap(element =>
        (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '')
            .split('\n').map(clean).filter(Boolean)
    );
    const links = [...document.querySelectorAll('footer a[href*="/artist/"]')]
        .map(element => clean(element.innerText || element.getAttribute('aria-label')))
        .filter(Boolean);
    const albumElement = document.querySelector('[data-testid="context-item-link"][href*="/album/"], footer a[href*="/album/"]');
    album = clean(albumElement?.innerText || albumElement?.getAttribute('aria-label') || '');
    title = title || textCandidates.find(value => value !== artist) || '';
    artist = artist || links[0] || textCandidates.find(value => value !== title) || '';
    return { title, artist, album };
}

function getSpotifyPaused(audio, playingAudio) {
    if (playingAudio) return false;
    const playButton = document.querySelector('[data-testid="control-button-playpause"]');
    const label = playButton ? `${playButton.getAttribute('aria-label') || ''} ${playButton.innerText || ''}`.toLowerCase() : '';
    if (label.includes('pause')) return false;
    if (label.includes('play')) return true;
    return audio ? audio.paused : true;
}

function parseClock(value) {
    const parts = value.trim().split(':').map(part => Number(part));
    if (parts.some(part => !Number.isFinite(part)) || parts.length < 2) return 0;
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
}

let lastLyricsTrack = "";
let lastLyricsRequest = 0;
let lastLyricsStatusTrack = "";
let lyricsRequestInFlight = false;

function emitPlaybackState() {
    const state = getSpotifyState();
    window.postMessage({ type: 'UPDATE_TIME', time: state.currentTime }, '*');
    window.postMessage({ type: 'UPDATE_PLAYER_STATE', state }, '*');
}

function watchSpotifyAudio() {
    document.querySelectorAll('audio').forEach(audio => {
        if (audio.dataset.lyricsPipWatched === 'true') return;
        audio.dataset.lyricsPipWatched = 'true';
        ['timeupdate', 'seeking', 'seeked', 'durationchange', 'play', 'pause'].forEach(eventName => {
            audio.addEventListener(eventName, emitPlaybackState);
        });
    });
}

// Keep playback time smooth while limiting lyric lookups to once every 3 seconds.
setInterval(() => {
    watchSpotifyAudio();
    const state = getSpotifyState();
    window.postMessage({ type: 'UPDATE_TIME', time: state.currentTime }, '*');
    window.postMessage({ type: 'UPDATE_PLAYER_STATE', state }, '*');

    if (state.title && state.artist) {
        const trackKey = state.trackKey;
        const shouldRetry = !lyricsRequestInFlight && Date.now() - lastLyricsRequest >= 10000;
        const shouldFetchLyrics = trackKey !== lastLyricsTrack || shouldRetry;
        if (shouldFetchLyrics) {
            lastLyricsTrack = trackKey;
            lastLyricsRequest = Date.now();
            lyricsRequestInFlight = true;
            if (lastLyricsStatusTrack !== trackKey) {
                lastLyricsStatusTrack = trackKey;
                window.postMessage({ type: 'LYRICS_STATUS', status: 'Mencari lirik...' }, '*');
            }
            chrome.runtime.sendMessage({ action: "fetch_lyrics", data: { title: state.title, artist: state.artist, album: state.album, duration: state.duration } })
                .then(response => {
                    lyricsRequestInFlight = false;
                    if (response && (response.status === 'success' || response.status === 'no_synced_lyrics' || (response.status === 'cached' && response.lyrics.length))) {
                        window.postMessage({ type: 'UPDATE_LYRICS', lyrics: response.lyrics }, '*');
                        window.postMessage({ type: 'LYRICS_STATUS', status: response.status === 'success' || response.status === 'cached' ? 'Lirik siap' : 'Lirik synced tidak ditemukan' }, '*');
                        if (response.status === 'no_synced_lyrics') {
                            lastLyricsRequest = Date.now() + 60000;
                        }
                    } else if (response?.status === 'error') {
                        window.postMessage({ type: 'LYRICS_STATUS', status: 'Gagal mengambil lirik' }, '*');
                        lastLyricsRequest = Date.now() + 30000;
                    }
                })
                .catch(() => {
                    lyricsRequestInFlight = false;
                    window.postMessage({ type: 'LYRICS_STATUS', status: 'Gagal mengambil lirik' }, '*');
                    lastLyricsRequest = Date.now() + 30000;
                });
        }
    } else {
        window.postMessage({ type: 'LYRICS_STATUS', status: 'Menunggu lagu aktif...' }, '*');
    }
}, 100);

// Jalankan saat halaman siap
if (document.readyState === 'complete') {
    injectMainWorldScript();
    injectButton();
} else {
    window.addEventListener('load', () => {
        injectMainWorldScript();
        injectButton();
    });
}

let clockSample = { trackKey: '', time: 0, wallTime: 0, paused: true };
let cachedSpotifyAudio = null;