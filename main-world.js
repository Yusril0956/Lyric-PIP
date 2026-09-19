let pipWindow = null;
let latestPlaybackDuration = 0;
let cachedSpotifyAudio = null;

// Dengarkan klik tombol dari content script agar requestWindow tetap memiliki user activation.
document.addEventListener('click', (event) => {
    if (event.target.closest('#pip-lyrics-btn')) {
        openPiP();
    }
});

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'UPDATE_LYRICS') {
        if (pipWindow && !pipWindow.closed) {
            pipWindow.postMessage({ type: 'UPDATE_LYRICS', lyrics: event.data.lyrics }, '*');
        }
    } else if (event.data.type === 'UPDATE_TIME') {
        if (pipWindow && !pipWindow.closed) {
            pipWindow.postMessage({ type: 'UPDATE_TIME', time: event.data.time }, '*');
        }
    } else if (event.data.type === 'UPDATE_PLAYER_STATE') {
        if (pipWindow && !pipWindow.closed) {
            pipWindow.postMessage({ type: 'UPDATE_PLAYER_STATE', state: event.data.state }, '*');
        }
    } else if (event.data.type === 'SEEK_RESULT') {
        if (pipWindow && !pipWindow.closed) {
            pipWindow.postMessage({ type: 'SEEK_RESULT', success: event.data.success, requested: event.data.requested, actual: event.data.actual }, '*');
        }
    } else if (event.data.type === 'LYRICS_STATUS') {
        if (pipWindow && !pipWindow.closed) {
            pipWindow.postMessage({ type: 'LYRICS_STATUS', status: event.data.status }, '*');
        }
    }
});

function openPiP() {
    if (pipWindow && !pipWindow.closed) {
        pipWindow.focus();
        window.postMessage({ type: 'PIP_OPENED' }, '*');
        return;
    }

    // Cek dukungan browser
    if (!window.documentPictureInPicture) {
        window.postMessage({ type: 'PIP_ERROR', message: 'Browser tidak mendukung Document PiP (Butuh Chrome/Edge/Brave 116+).' }, '*');
        return;
    }

    window.documentPictureInPicture.requestWindow({ width: 420, height: 680 }).then((win) => {
        pipWindow = win;

        // 1. Buat seluruh dokumen HTML, CSS, dan JS sebagai satu string
        // Perhatikan: <\/script> digunakan agar tidak memotong string JavaScript di luar
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Spotify Lyrics PiP</title>
                <style>
                    :root {
                        color-scheme: dark;
                        --glass: rgba(255,255,255,0.055);
                        --glass-strong: rgba(17,18,19,0.66);
                        --glass-border: rgba(255,255,255,0.09);
                        --text: #f5f6f5;
                        --text-dim: rgba(245,246,245,0.55);
                        --text-dimmer: rgba(245,246,245,0.24);
                        --track: rgba(255,255,255,0.14);
                        --accent: #3ddc84;
                        --radius-lg: 20px;
                        --radius-md: 13px;
                    }
                    * { box-sizing: border-box; }
                    html, body { height: 100%; }
                    body {
                        margin: 0;
                        overflow: hidden;
                        background: radial-gradient(130% 100% at 50% -10%, #1a1c1d 0%, #0c0d0e 55%, #060707 100%);
                        color: var(--text-dim);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
                        -webkit-font-smoothing: antialiased;
                    }

                    #lyrics-container { position: relative; height: 100vh; width: 100vw; overflow: hidden; }

                    /* ---------- Lyrics (full-bleed, sits behind the floating panels) ---------- */
                    #lyrics-list {
                        position: absolute; inset: 0;
                        z-index: 1;
                        overflow-y: auto;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                        scroll-behavior: smooth;
                        display: flex;
                        flex-direction: column;
                        align-items: stretch;
                        justify-content: flex-start;
                        gap: 2px;
                        padding: 92px 28px 138px;
                        mask-image: linear-gradient(to bottom, transparent 0, #000 84px, #000 calc(100% - 128px), transparent 100%);
                        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 84px, #000 calc(100% - 128px), transparent 100%);
                    }
                    #lyrics-list::-webkit-scrollbar { width: 0; height: 0; display: none; background: transparent; }

                    .lyric-line {
                        max-width: 320px;
                        margin: 8px auto;
                        padding: 2px 6px;
                        text-align: center;
                        font-size: 15px;
                        line-height: 1.45;
                        font-weight: 500;
                        letter-spacing: 0.005em;
                        color: var(--text-dimmer);
                        cursor: pointer;
                        transition: color .35s ease, font-size .35s ease, font-weight .2s ease, transform .35s ease, text-shadow .35s ease;
                    }
                    .lyric-line:hover { color: var(--text-dim); }
                    .lyric-line.near { color: rgba(245,246,245,0.6); font-size: 15.5px; font-weight: 600; }
                    .lyric-line.active {
                        color: var(--text);
                        font-size: 21px;
                        font-weight: 700;
                        transform: scale(1.015);
                        text-shadow: 0 0 26px rgba(61,220,132,0.22);
                    }

                    /* ---------- Header (floating glass strip) ---------- */
                    #track-header {
                        position: absolute; top: 0; left: 0; right: 0; z-index: 3;
                        display: flex; align-items: flex-start; gap: 11px;
                        padding: 15px 18px 13px;
                        background: linear-gradient(to bottom, rgba(8,9,10,0.86) 0%, rgba(8,9,10,0.5) 75%, transparent 100%);
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                    }
                    #track-art {
                        flex: 0 0 32px; width: 32px; height: 32px; margin-top: 1px;
                        display: grid; place-items: center;
                        border-radius: 9px;
                        background: var(--glass);
                        border: 1px solid var(--glass-border);
                        color: var(--text-dim);
                    }
                    #track-art svg { width: 15px; height: 15px; fill: currentColor; }
                    #track-copy { min-width: 0; flex: 1; }
                    #track-title {
                        color: var(--text); font-size: 14px; font-weight: 700; line-height: 1.3;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    #track-artist {
                        color: var(--text-dim); font-size: 11.5px; margin-top: 2px;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    #status {
                        font-size: 10px; color: rgba(61,220,132,0.85); margin-top: 4px; min-height: 12px;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }

                    /* ---------- Sync pill (jump back to current line) ---------- */
                    #sync-button {
                        display: flex; align-items: center; gap: 6px;
                        position: absolute; left: 50%; bottom: 130px; z-index: 4;
                        transform: translate(-50%, 6px);
                        padding: 7px 13px;
                        border: 1px solid var(--glass-border);
                        border-radius: 999px;
                        background: var(--glass-strong);
                        backdrop-filter: blur(12px);
                        -webkit-backdrop-filter: blur(12px);
                        color: var(--text);
                        font-size: 11px; font-weight: 600;
                        cursor: pointer;
                        opacity: 0; pointer-events: none;
                        transition: opacity .18s ease, transform .18s ease;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.35);
                    }
                    #sync-button svg { width: 12px; height: 12px; fill: var(--accent); }
                    #sync-button.visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }

                    /* ---------- Player (floating glass card) ---------- */
                    #player {
                        position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 3;
                        padding: 13px 15px 12px;
                        border-radius: var(--radius-lg);
                        background: var(--glass-strong);
                        border: 1px solid var(--glass-border);
                        backdrop-filter: blur(22px);
                        -webkit-backdrop-filter: blur(22px);
                        box-shadow: 0 12px 32px rgba(0,0,0,0.38);
                    }

                    #scrub-row { display: flex; align-items: center; gap: 9px; }
                    .time { font-size: 10px; color: var(--text-dimmer); min-width: 28px; font-variant-numeric: tabular-nums; }
                    #current-time { text-align: left; }
                    #duration { text-align: right; }

                    input[type="range"] {
                        -webkit-appearance: none; appearance: none;
                        background: transparent; margin: 0; cursor: pointer;
                    }
                    #progress { flex: 1; height: 14px; }
                    #progress::-webkit-slider-runnable-track {
                        height: 3px; border-radius: 999px;
                        background: linear-gradient(to right, var(--text) 0%, var(--text) var(--range-progress, 0%), var(--track) var(--range-progress, 0%), var(--track) 100%);
                    }
                    #progress::-webkit-slider-thumb {
                        -webkit-appearance: none; width: 11px; height: 11px; margin-top: -4px;
                        border-radius: 50%; background: #fff;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                        opacity: 0; transition: opacity .15s ease;
                    }
                    #progress:hover::-webkit-slider-thumb,
                    #progress:active::-webkit-slider-thumb,
                    #progress:focus-visible::-webkit-slider-thumb { opacity: 1; }

                    #player-controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-top: 11px; }
                    #volume-wrap { display: flex; align-items: center; gap: 6px; justify-self: start; }
                    #transport { display: flex; align-items: center; gap: 4px; justify-self: center; }

                    .icon-btn {
                        display: grid; place-items: center;
                        width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%;
                        background: transparent; color: rgba(245,246,245,0.75);
                        cursor: pointer;
                        transition: color .15s ease, background .15s ease, transform .1s ease;
                    }
                    .icon-btn svg { width: 15px; height: 15px; fill: currentColor; }
                    .icon-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }
                    .icon-btn:active { transform: scale(0.9); }
                    #play-pause { width: 38px; height: 38px; background: var(--text); color: #0a0b0a; }
                    #play-pause svg { width: 16px; height: 16px; }
                    #play-pause:hover { background: #fff; color: #0a0b0a; }

                    #volume { width: 60px; height: 14px; }
                    #volume::-webkit-slider-runnable-track {
                        height: 3px; border-radius: 999px;
                        background: linear-gradient(to right, var(--text) 0%, var(--text) var(--range-progress, 0%), var(--track) var(--range-progress, 0%), var(--track) 100%);
                    }
                    #volume::-webkit-slider-thumb {
                        -webkit-appearance: none; width: 9px; height: 9px; margin-top: -3px;
                        border-radius: 50%; background: #fff;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
                        opacity: 0; transition: opacity .15s ease;
                    }
                    #volume:hover::-webkit-slider-thumb,
                    #volume:active::-webkit-slider-thumb,
                    #volume:focus-visible::-webkit-slider-thumb { opacity: 1; }
                </style>
            </head>
            <body>
                <div id="lyrics-container">
                    <div id="lyrics-list"></div>

                    <div id="track-header">
                        <div id="track-art"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm0 2a7 7 0 1 1-7 7 7.01 7.01 0 0 1 7-7Zm-1 2v7.17a2.5 2.5 0 1 0 1.5 2.33V10h3V8Z"/></svg></div>
                        <div id="track-copy">
                            <div id="track-title">Spotify Lyrics</div>
                            <div id="track-artist">Player siap</div>
                            <div id="status">Memuat lirik...</div>
                        </div>
                    </div>

                    <button id="sync-button" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 0 1 7.2 4.5l-1.8.9A6 6 0 0 0 6.2 8H9V6H3v6h2V9.6A8 8 0 0 1 12 4Zm6 10h-2.8v2a6 6 0 0 1-10.4-1.4l-1.8.9A8 8 0 0 0 18.9 16H21v-6h-2v4Z"/></svg><span>Sync</span></button>

                    <div id="player">
                        <div id="scrub-row">
                            <span id="current-time" class="time">0:00</span>
                            <input id="progress" type="range" min="0" max="0" value="0" step="0.1" aria-label="Seek lagu">
                            <span id="duration" class="time">0:00</span>
                        </div>
                        <div id="player-controls">
                            <div id="volume-wrap">
                                <button class="icon-btn" id="mute" type="button" aria-label="Mute"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5 0-1.1 1.1 1.9 1.9-1.9 1.9 1.1 1.1 1.9-1.9 1.9 1.9 1.1-1.1-1.9-1.9 1.9-1.9-1.1-1.1-1.9 1.9-1.9-1.9Z"/></svg></button>
                                <input id="volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volume">
                            </div>
                            <div id="transport">
                                <button class="icon-btn" id="previous" type="button" aria-label="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6V5Zm3.5 7 9.5-7v14l-9.5-7Z"/></svg></button>
                                <button class="icon-btn" id="play-pause" type="button" aria-label="Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z"/></svg></button>
                                <button class="icon-btn" id="next" type="button" aria-label="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2V5Zm-1.5 7L5 5v14l9.5-7Z"/></svg></button>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Tulis isi langsung agar Document PiP tidak bergantung pada navigasi URL Blob.
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        setupPipWindow(win);
        window.postMessage({ type: 'PIP_OPENED' }, '*');

        // Tutup referensi jika tab Spotify ditutup
        win.addEventListener('pagehide', () => {
            pipWindow = null;
        });

    }).catch(err => {
        console.error("PiP Error: - main-world.js:119", err);
        window.postMessage({ type: 'PIP_ERROR', message: err.message }, '*');
    });
}

function setupPipWindow(win) {
    let currentLyrics = [];
    let currentTime = 0;
    let activeIndex = -1;
    let userScrolledAway = false;
    let programmaticScroll = false;
    const pipDocument = win.document;
    const list = pipDocument.getElementById('lyrics-list');
    const syncButton = pipDocument.getElementById('sync-button');
    const progress = pipDocument.getElementById('progress');
    const volume = pipDocument.getElementById('volume');
    const playPause = pipDocument.getElementById('play-pause');
    const mute = pipDocument.getElementById('mute');
    const statusEl = pipDocument.getElementById('status');
    let isSeeking = false;
    let isChangingVolume = false;
    let lastRequestedSeek = null;
    let seekTimeout = null;
    let seekFadeTimeout = null;
    let seekInteractionId = 0;
    let committedSeekInteraction = 0;

    // Cat ulang fill slider progress & volume secara visual (native <input type=range> tidak
    // punya dua warna bawaan, jadi kita pakai CSS var yang di-update lewat JS).
    setRangeFill(progress, Number(progress.value), Number(progress.max) || 1);
    setRangeFill(volume, Number(volume.value), 1);

    playPause.addEventListener('click', () => controlSpotifyPlayback('toggle'));
    pipDocument.getElementById('previous').addEventListener('click', () => controlSpotifyPlayback('previous'));
    pipDocument.getElementById('next').addEventListener('click', () => controlSpotifyPlayback('next'));

    progress.addEventListener('pointerdown', () => {
        isSeeking = true;
        seekInteractionId += 1;
    });
    progress.addEventListener('input', () => {
        const value = Number(progress.value);
        setRangeFill(progress, value, Number(progress.max) || 1);
        pipDocument.getElementById('current-time').textContent = formatTime(value);
    });
    const commitSeek = () => {
        if (committedSeekInteraction === seekInteractionId) return;
        committedSeekInteraction = seekInteractionId;
        isSeeking = false;
        lastRequestedSeek = Number(progress.value);
        clearTimeout(seekTimeout);
        clearTimeout(seekFadeTimeout);
        statusEl.textContent = 'Memindahkan posisi...';
        // Beri Spotify waktu lebih longgar untuk buffering di posisi baru sebelum
        // kita anggap seek gagal (bukan hanya lambat).
        seekTimeout = setTimeout(() => {
            lastRequestedSeek = null;
            statusEl.textContent = 'Seek Spotify gagal';
            seekFadeTimeout = setTimeout(() => {
                if (statusEl.textContent === 'Seek Spotify gagal') statusEl.textContent = '';
            }, 2200);
        }, 3000);
        controlSpotifyPlayback('seek', lastRequestedSeek);
    };
    progress.addEventListener('pointerup', commitSeek);
    progress.addEventListener('pointercancel', () => {
        isSeeking = false;
        committedSeekInteraction = seekInteractionId;
    });
    progress.addEventListener('change', commitSeek);
    progress.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            seekInteractionId += 1;
        }
    });

    volume.addEventListener('pointerdown', () => { isChangingVolume = true; });
    volume.addEventListener('input', () => {
        const value = Number(volume.value);
        setRangeFill(volume, value, 1);
        controlSpotifyPlayback('volume', value);
    });
    volume.addEventListener('pointerup', () => { isChangingVolume = false; });
    volume.addEventListener('change', () => { isChangingVolume = false; });
    mute.addEventListener('click', () => controlSpotifyPlayback('mute'));

    list.addEventListener('scroll', () => {
        if (programmaticScroll || activeIndex < 0) return;
        const activeLine = list.children[activeIndex];
        if (!activeLine) return;
        const activeCenter = activeLine.offsetTop + activeLine.offsetHeight / 2;
        const viewportCenter = list.scrollTop + list.clientHeight / 2;
        userScrolledAway = Math.abs(activeCenter - viewportCenter) > list.clientHeight * 0.35;
        syncButton.classList.toggle('visible', userScrolledAway);
    });

    syncButton.addEventListener('click', () => {
        userScrolledAway = false;
        syncButton.classList.remove('visible');
        programmaticScroll = true;
        scrollToActiveLine(list, activeIndex, true, () => {
            programmaticScroll = false;
        });
    });

    win.addEventListener('message', (event) => {
        if (event.data.type === 'UPDATE_LYRICS') {
            currentLyrics = event.data.lyrics;
            activeIndex = -1;
            renderLyrics(pipDocument, currentLyrics);
            activeIndex = findActiveLyric(currentLyrics, currentTime);
            updateActiveLyric(pipDocument, currentLyrics, currentTime, activeIndex);
        } else if (event.data.type === 'UPDATE_TIME') {
            currentTime = event.data.time;
            const nextIndex = findActiveLyric(currentLyrics, currentTime);
            if (nextIndex !== activeIndex) {
                activeIndex = nextIndex;
                updateActiveLyric(pipDocument, currentLyrics, currentTime, activeIndex);
                if (!userScrolledAway) {
                    programmaticScroll = true;
                    scrollToActiveLine(list, activeIndex, true, () => {
                        programmaticScroll = false;
                    });
                }
            }
        } else if (event.data.type === 'UPDATE_PLAYER_STATE') {
            if (lastRequestedSeek !== null && Math.abs(event.data.state.currentTime - lastRequestedSeek) < 2) {
                // Posisi asli sudah benar-benar berpindah mendekati target -> seek dianggap berhasil.
                lastRequestedSeek = null;
                clearTimeout(seekTimeout);
                clearTimeout(seekFadeTimeout);
                if (statusEl.textContent === 'Memindahkan posisi...' || statusEl.textContent === 'Seek Spotify gagal') {
                    statusEl.textContent = '';
                }
            }
            updatePlayerState(pipDocument, event.data.state, {
                isSeeking: isSeeking || lastRequestedSeek !== null,
                isChangingVolume
            });
        } else if (event.data.type === 'SEEK_RESULT') {
            clearTimeout(seekTimeout);
            clearTimeout(seekFadeTimeout);
            lastRequestedSeek = null;
            statusEl.textContent = event.data.success ? '' : 'Seek Spotify gagal';
        } else if (event.data.type === 'LYRICS_STATUS') {
            statusEl.textContent = event.data.status;
        }
    });
}

function getSpotifyAudio() {
    const audioElements = [...document.querySelectorAll('audio')];
    const playingAudio = audioElements.find(audio => !audio.paused && audio.readyState > 0);
    if (playingAudio) {
        cachedSpotifyAudio = playingAudio;
        return playingAudio;
    }
    if (cachedSpotifyAudio && audioElements.includes(cachedSpotifyAudio)) return cachedSpotifyAudio;
    cachedSpotifyAudio = audioElements
        .filter(audio => Number.isFinite(audio.currentTime) && Number.isFinite(audio.duration) && audio.duration > 0)
        .sort((firstAudio, secondAudio) => secondAudio.duration - firstAudio.duration)[0] || null;
    return cachedSpotifyAudio;
}

function findSpotifyButton(kind) {
    const selectors = {
        previous: ['[data-testid="control-button-skip-back"]', '[aria-label*="Previous"]', '[aria-label*="previous"]'],
        next: ['[data-testid="control-button-skip-forward"]', '[aria-label*="Next"]', '[aria-label*="next"]'],
        play: ['[data-testid="control-button-playpause"]'],
        mute: ['[data-testid="control-button-volume"]', '[aria-label*="Mute"]', '[aria-label*="Unmute"]'],
        volume: ['[data-testid="volume-bar"] input[type="range"]', '[data-testid="volume-bar"] [role="slider"]', 'input[type="range"][aria-label*="Volume"]', '[role="slider"][aria-label*="Volume"]']
    };
    for (const selector of selectors[kind]) {
        const button = document.querySelector(selector);
        if (button) return button;
    }
    return null;
}

function findSpotifyProgress() {
    const candidates = [...document.querySelectorAll(
        '[data-testid="playback-progressbar"] input[type="range"], ' +
        '[data-testid="progress-bar"], ' +
        '[data-testid="playback-progressbar"] [role="slider"], ' +
        '[data-testid="playback-progressbar"], ' +
        'input[type="range"][aria-label*="Seek"], ' +
        '[role="slider"][aria-valuemax], ' +
        '[role="slider"][aria-label*="progress"], ' +
        '[role="slider"][aria-label*="Progress"]'
    )];
    return candidates.find(candidate => {
        const label = `${candidate.getAttribute('aria-label') || ''} ${candidate.getAttribute('data-testid') || ''}`.toLowerCase();
        return !label.includes('volume') && !label.includes('mute');
    }) || null;
}

function getSliderMax(slider) {
    if (!slider) return 0;
    const ariaMax = Number(slider.getAttribute && slider.getAttribute('aria-valuemax'));
    if (Number.isFinite(ariaMax) && ariaMax > 0) return ariaMax;
    const nativeMax = Number(slider.max);
    if (Number.isFinite(nativeMax) && nativeMax > 0) return nativeMax;
    return 0;
}

function controlSpotifyPlayback(command, value) {
    const audio = getSpotifyAudio();
    if (command === 'previous' || command === 'next') {
        const button = findSpotifyButton(command);
        if (button) button.click();
        return;
    }
    if (command === 'toggle') {
        const spotifyButton = findSpotifyButton('play');
        if (spotifyButton) spotifyButton.click();
        else if (audio && audio.paused) audio.play().catch(() => {});
        else if (audio) audio.pause();
    } else if (command === 'seek' && Number.isFinite(value)) {
        // PENTING: Spotify Web Player memutar audio lewat pipeline ber-DRM/tersegmentasi yang
        // disinkronkan oleh state internal Spotify sendiri. Mengatur audio.currentTime secara
        // langsung TIDAK benar-benar memindahkan posisi pemutaran nyata: nilainya bisa berubah
        // sesaat lalu ditimpa balik oleh Spotify begitu ia resync (persis gejala bug: posisi
        // "kembali ke posisi sebelumnya"). Cara yang benar-benar dapat dipercaya adalah
        // mensimulasikan interaksi asli pada seekbar Spotify sendiri, supaya handler internal
        // Spotify (yang benar-benar memanggil seek pada player-nya) yang menjalankan seek-nya.
        const progressEl = findSpotifyProgress();
        const maximum = getSliderMax(progressEl)
            || (Number.isFinite(audio?.duration) && audio.duration > 0 ? audio.duration : 0)
            || latestPlaybackDuration
            || value
            || 1;
        const uiHandled = setSpotifySlider(progressEl, value, maximum);
        if (!uiHandled) {
            // Fallback terakhir hanya jika seekbar Spotify sama sekali tidak ditemukan di DOM.
            const fallbackWorked = audio ? seekActiveAudio(audio, value) : false;
            if (!fallbackWorked) {
                window.postMessage({ type: 'SEEK_RESULT', success: false, requested: value, actual: null }, '*');
            }
        }
        // Hasil (berhasil/gagal) yang otoritatif ditentukan oleh posisi playback nyata yang
        // dilaporkan lewat polling UPDATE_PLAYER_STATE di setupPipWindow, bukan di sini.
    } else if (command === 'volume' && Number.isFinite(value)) {
        if (audio) {
            audio.volume = Math.max(0, Math.min(1, value));
            audio.muted = audio.volume === 0;
        }
        const volumeSlider = findSpotifyButton('volume');
        if (!setSpotifySlider(volumeSlider, value, 1) && audio) {
            audio.volume = Math.max(0, Math.min(1, value));
            audio.muted = audio.volume === 0;
        }
    } else if (command === 'mute') {
        const muteButton = findSpotifyButton('mute');
        if (muteButton) muteButton.click();
        else if (audio) audio.muted = !audio.muted;
    }
}

function setSpotifySlider(slider, value, maximum) {
    if (!slider) return false;
    const max = maximum > 0 ? maximum : (getSliderMax(slider) || 1);
    const ratio = Math.max(0, Math.min(1, value / max));

    if (slider.tagName === 'INPUT' && 'value' in slider) {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const min = Number(slider.min) || 0;
        const inputMax = Number(slider.max) || max;
        const sliderValue = Math.max(min, Math.min(inputMax, ratio * inputMax));
        if (valueSetter) valueSetter.call(slider, sliderValue);
        else slider.value = sliderValue;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    // Elemen non-input (mis. <div role="slider">): simulasikan klik/drag asli pada posisi yang
    // tepat, lengkap dengan pointer & mouse events, supaya handler drag-gesture Spotify ikut
    // terpicu, bukan hanya event click sederhana.
    const rect = slider.getBoundingClientRect();
    if (!rect.width) return false;
    const clientX = rect.left + rect.width * ratio;
    const clientY = rect.top + rect.height / 2;
    const eventInit = { bubbles: true, cancelable: true, clientX, clientY, buttons: 1, pointerId: 1, isPrimary: true };
    if (typeof PointerEvent === 'function') {
        slider.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        slider.dispatchEvent(new PointerEvent('pointermove', eventInit));
        slider.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));
    }
    slider.dispatchEvent(new MouseEvent('mousedown', eventInit));
    slider.dispatchEvent(new MouseEvent('mousemove', eventInit));
    slider.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
    slider.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
    return true;
}

function updatePlayerState(pipDocument, state, interactionState = {}) {
    const duration = Number.isFinite(state.duration) ? state.duration : 0;
    const currentTime = Number.isFinite(state.currentTime) ? state.currentTime : 0;
    latestPlaybackDuration = duration;
    const progress = pipDocument.getElementById('progress');
    if (!interactionState.isSeeking) {
        progress.max = duration;
        const displayTime = Math.min(currentTime, duration || currentTime);
        progress.value = displayTime;
        setRangeFill(progress, displayTime, duration || 1);
        pipDocument.getElementById('current-time').textContent = formatTime(currentTime);
    }
    pipDocument.getElementById('duration').textContent = formatTime(duration);
    pipDocument.getElementById('track-title').textContent = state.title || 'Spotify Lyrics';
    pipDocument.getElementById('track-artist').textContent = state.artist || 'Player siap';
    pipDocument.getElementById('play-pause').innerHTML = state.paused
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7V5Zm7 0h3v14h-3V5Z"/></svg>';
    pipDocument.getElementById('play-pause').setAttribute('aria-label', state.paused ? 'Play' : 'Pause');
    pipDocument.getElementById('mute').innerHTML = state.muted || state.volume === 0
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 9 4 0 5-4v5l5-5 1.4 1.4L5.8 19 4 17.2V9Zm9 6v4l-5-4H4v-2.2l9-9V15Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5 0-1.1 1.1 1.9 1.9-1.9 1.9 1.1 1.1 1.9-1.9 1.9 1.9 1.1-1.1-1.9-1.9 1.9-1.9-1.1-1.1-1.9 1.9-1.9-1.9Z"/></svg>';
    const volume = pipDocument.getElementById('volume');
    if (!interactionState.isChangingVolume && pipDocument.activeElement !== volume) {
        volume.value = state.volume;
        setRangeFill(volume, state.volume, 1);
    }
}

function setRangeFill(el, value, max) {
    const total = Number(max) || 0;
    const percent = total > 0 ? Math.max(0, Math.min(100, (Number(value) / total) * 100)) : 0;
    el.style.setProperty('--range-progress', percent + '%');
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
}

function renderLyrics(pipDocument, lyrics) {
    const list = pipDocument.getElementById('lyrics-list');
    const status = pipDocument.getElementById('status');
    list.innerHTML = '';
    list.style.justifyContent = 'flex-start';
    if (!lyrics || lyrics.length === 0) {
        status.textContent = 'Lirik synced tidak ditemukan.';
        return;
    }
    status.textContent = '';
    const fragment = pipDocument.createDocumentFragment();
    lyrics.forEach((line) => {
        const lyricLine = pipDocument.createElement('div');
        lyricLine.className = 'lyric-line';
        lyricLine.textContent = line.text;
        lyricLine.dataset.time = line.time;
        fragment.appendChild(lyricLine);
    });
    list.appendChild(fragment);
    // Pusatkan secara vertikal HANYA kalau lirik lebih pendek dari tinggi viewport
    // (tidak overflow). Menyalakan justify-content:center saat konten overflow akan
    // membuat browser menghitung offsetTop dengan offset negatif yang merusak
    // scrollToActiveLine() (auto-scroll akan diam di posisi 0 terus). Jadi ini hanya
    // aman diaktifkan ketika scrollHeight <= clientHeight (tidak ada yang perlu di-scroll).
    if (list.scrollHeight <= list.clientHeight) {
        list.style.justifyContent = 'center';
    }
}

function findActiveLyric(lyrics, currentTime) {
    if (!lyrics.length || !Number.isFinite(currentTime)) return -1;
    let low = 0;
    let high = lyrics.length - 1;
    let activeIndex = -1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (lyrics[middle].time <= currentTime) {
            activeIndex = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return activeIndex;
}

function updateActiveLyric(pipDocument, lyrics, currentTime, activeIndex) {
    if (!lyrics.length) return;
    const lines = pipDocument.querySelectorAll('.lyric-line');
    lines.forEach((line, index) => {
        line.classList.remove('active', 'near');
        if (activeIndex < 0) return;
        const distance = Math.abs(index - activeIndex);
        if (distance === 0) line.classList.add('active');
        else if (distance === 1) line.classList.add('near');
    });
}

function scrollToActiveLine(list, activeIndex, smooth, onComplete) {
    if (activeIndex < 0 || !list.children[activeIndex]) return;
    const activeLine = list.children[activeIndex];
    const targetTop = activeLine.offsetTop - (list.clientHeight - activeLine.offsetHeight) / 2;
    list.scrollTo({ top: Math.max(0, targetTop), behavior: smooth ? 'smooth' : 'auto' });
    if (onComplete) {
        setTimeout(onComplete, smooth ? 350 : 0);
    }
}

function seekActiveAudio(audio, targetSeconds) {
    // Fallback darurat saja (dipakai hanya bila seekbar asli Spotify tidak ditemukan di DOM).
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : latestPlaybackDuration;
    const target = Math.max(0, Math.min(targetSeconds, duration || targetSeconds));
    try {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            audio.removeEventListener('seeked', finish);
            audio.removeEventListener('timeupdate', finish);
            const actual = Number.isFinite(audio.currentTime) ? audio.currentTime : NaN;
            window.postMessage({ type: 'SEEK_RESULT', success: Number.isFinite(actual) && Math.abs(actual - target) < 1, requested: target, actual }, '*');
        };
        audio.addEventListener('seeked', finish);
        audio.addEventListener('timeupdate', finish);
        setTimeout(finish, 1000);
        if (typeof audio.fastSeek === 'function') audio.fastSeek(target);
        audio.currentTime = target;
        return true;
    } catch (error) {
        return false;
    }
}
