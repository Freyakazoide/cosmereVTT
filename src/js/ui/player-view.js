const isPlayerView = window.location.search.includes('player=true');
window.isPlayerView = isPlayerView;
window.playerViewStatus = window.playerViewStatus || {
    open: false,
    lastSyncAt: null,
    sceneName: '',
    handout: null
};

if (isPlayerView) {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('player-view');
        document.getElementById('sidebar')?.style.setProperty('display', 'none');
        document.getElementById('btn-toggle-menu')?.style.setProperty('display', 'none');
        document.getElementById('btn-help')?.style.setProperty('display', 'none');
        document.getElementById('global-actions')?.style.setProperty('display', 'none');
        document.querySelectorAll('.dock-section, .tool-separator').forEach(el => {
            el.classList.add('player-hidden-panel');
        });
        showPlayerWaitingScreen();
        if (typeof setTool === 'function') setTool('select', document.querySelector('.tool-submenu .tool-btn'));
    });

    if (window.api?.onUpdateBoard) {
        window.api.onUpdateBoard((state) => {
            if (state?.type === 'show-note') {
                renderPlayerNote(state.note);
                return;
            }

            if (state?.type === 'update-permissions') {
                applyPlayerPermissionUpdate(state);
                return;
            }

            if (!state || state.type) return;

            if (window.phaserScene) {
                const boardState = typeof window.normalizeBoardState === 'function'
                    ? window.normalizeBoardState(state)
                    : state;
                const playerBoardState = typeof window.filterPlayerSafeBoardState === 'function'
                    ? window.filterPlayerSafeBoardState(boardState)
                    : {
                        ...boardState,
                        tokens: (boardState.tokens || []).filter(token => token.visibleToPlayers !== false),
                        drawings: (boardState.drawings || []).filter(drawing => drawing.visibleToPlayers !== false)
                    };
                window.phaserScene.loadBoardState(playerBoardState);
                renderPlayerSceneNotes(playerBoardState);
                if (boardState.weather) window.phaserScene.setAdvancedWeather(boardState.weather);
                hidePlayerWaitingScreen();
            }
        });
    }

    if (window.api?.onPing) window.api.onPing(renderPlayerPing);
    if (window.api?.onShowHandout) window.api.onShowHandout(renderPlayerHandout);
    if (window.api?.onHideHandout) window.api.onHideHandout(hidePlayerHandout);
}

function escapePlayerHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function showPlayerWaitingScreen() {
    if (!isPlayerView || document.getElementById('player-waiting-screen')) return;
    const wait = document.createElement('div');
    wait.id = 'player-waiting-screen';
    wait.innerHTML = `
        <div>
            <strong>Cosmere VTT</strong>
            <span>Aguardando sincronizacao do mestre...</span>
        </div>
    `;
    document.body.appendChild(wait);
}

function hidePlayerWaitingScreen() {
    document.getElementById('player-waiting-screen')?.remove();
}

function applyPlayerPermissionUpdate(payload) {
    if (!isPlayerView || !payload?.charId || payload.visible !== false) return;
    window.phaserScene?.removePlayerTokenById?.(payload.charId);
}

function renderPlayerPing(payload) {
    const point = normalizePlayerPingPayload(payload);
    if (!window.phaserScene || !point) return;
    const colorMap = {
        normal: 0xfbbf24,
        danger: 0xef4444,
        objective: 0x22c55e,
        info: 0x38bdf8
    };
    const scene = window.phaserScene;
    const ping = scene.add.graphics();
    ping.lineStyle(5, colorMap[point.type] || colorMap.normal, 1);
    ping.strokeCircle(0, 0, 18);
    ping.setPosition(point.x, point.y);
    scene.camadaUI.add(ping);
    scene.tweens.add({
        targets: ping,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 1200,
        ease: 'Sine.easeOut',
        onComplete: () => ping.destroy()
    });
}

function normalizePlayerPingPayload(payload) {
    if (!payload) return null;
    const x = Number(payload.x);
    const y = Number(payload.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, type: payload.type || 'normal' };
}

function getPlayerHandoutSource(path) {
    const value = String(path || '');
    if (
        value.startsWith('file://') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:')
    ) {
        return value;
    }
    return `file://${value}`;
}

function getPlayerYouTubeEmbedUrl(path) {
    try {
        const url = new URL(String(path || ''));
        const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
        let videoId = '';

        if (host === 'youtube.com' && url.pathname === '/watch') {
            videoId = url.searchParams.get('v') || '';
        } else if (host === 'youtu.be') {
            videoId = url.pathname.split('/').filter(Boolean)[0] || '';
        }

        return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1` : '';
    } catch (error) {
        return '';
    }
}

function getPlayerHandoutMedia(payload) {
    const path = String(payload?.path || '');
    const youtubeEmbedUrl = getPlayerYouTubeEmbedUrl(path);
    if (youtubeEmbedUrl) {
        return {
            kind: 'embed',
            source: youtubeEmbedUrl
        };
    }

    return {
        kind: payload?.type === 'video' || /\.(mp4|webm|ogg)$/i.test(path) ? 'video' : 'image',
        source: getPlayerHandoutSource(path)
    };
}

function renderPlayerHandout(payload) {
    if (!payload || !payload.path) return;
    hidePlayerHandout();

    const overlay = document.createElement('div');
    overlay.className = 'player-handout-overlay';
    const media = getPlayerHandoutMedia(payload);
    const source = escapePlayerHtml(media.source);
    const title = escapePlayerHtml(payload.title || payload.path.split(/[\\/]/).pop() || 'Handout');
    overlay.innerHTML = `
        <div class="player-handout-card">
            <header class="player-handout-card__header">
                <strong>${title}</strong>
                <button type="button" class="player-handout-card__close" data-handout-close title="Fechar"><i class="fas fa-times"></i></button>
            </header>
            ${media.kind === 'embed'
                ? `<iframe src="${source}" title="${title}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
                : media.kind === 'video'
                ? `<video src="${source}" controls autoplay></video>`
                : `<img src="${source}" alt="${title}">`
            }
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
        if (event.target.closest('[data-handout-close]')) overlay.remove();
    });
}

function hidePlayerHandout() {
    document.querySelector('.player-handout-overlay')?.remove();
}

function renderPlayerNote(note) {
    if (!note) return;
    document.querySelector('.player-note-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'player-note-overlay';
    const tags = (note.tags || []).map(tag => `<span>${escapePlayerHtml(tag)}</span>`).join('');
    overlay.innerHTML = `
        <article class="player-note-card">
            <div class="player-note-card__type">${escapePlayerHtml(note.type || 'Nota')}</div>
            <h2>${escapePlayerHtml(note.title || 'Nota Revelada')}</h2>
            <div class="player-note-card__body">${note.content || note.body || ''}</div>
            <div class="player-note-card__tags">${tags}</div>
        </article>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
}

function renderPlayerSceneNotes(state) {
    document.querySelector('.player-scene-notes')?.remove();
    if (!state) return;

    const notes = [
        ...(Array.isArray(state.revealedNotes) ? state.revealedNotes : []),
        ...(Array.isArray(state.sceneNotes) ? state.sceneNotes : []),
        ...(Array.isArray(state.sceneDirector?.pinnedNotes) ? state.sceneDirector.pinnedNotes : [])
    ].filter(note => note && note.isRevealed);

    const uniqueNotes = [];
    notes.forEach(note => {
        if (!uniqueNotes.some(existingNote => existingNote.id === note.id)) uniqueNotes.push(note);
    });

    if (uniqueNotes.length === 0) return;

    const dock = document.createElement('aside');
    dock.className = 'player-scene-notes';
    dock.innerHTML = `
        <div class="player-scene-notes__title">${escapePlayerHtml(state.sceneName || state.sceneDirector?.sceneName || 'Cena')}</div>
        ${uniqueNotes.map(note => `
            <button class="player-scene-note" data-note-id="${escapePlayerHtml(note.id)}">
                <span>${escapePlayerHtml(note.type || 'Nota')}</span>
                <strong>${escapePlayerHtml(note.title || 'Nota Revelada')}</strong>
            </button>
        `).join('')}
    `;
    document.body.appendChild(dock);
    dock.addEventListener('click', event => {
        const button = event.target.closest('[data-note-id]');
        if (!button) return;
        const note = uniqueNotes.find(item => item.id === button.dataset.noteId);
        renderPlayerNote(note);
    });
}

async function openPlayerScreen() {
    if (!window.api?.openPlayerView) {
        addChatMessage('Erro', 'API da tela do jogador nao esta disponivel. Verifique o preload.js.', '#ef4444');
        updatePlayerViewStatusCard({ open: false });
        return;
    }

    try {
        const result = await window.api.openPlayerView();
        if (!result?.ok) {
            addChatMessage('Erro', `Nao foi possivel abrir a Tela do Jogador: ${result?.error || 'erro desconhecido'}`, '#ef4444');
            updatePlayerViewStatusCard({ open: false });
            return;
        }

        addChatMessage(
            'Sistema',
            result.reused
                ? 'Tela de Jogador ja estava aberta. Janela focada novamente.'
                : 'Tela de Jogador lancada. Arraste para o segundo monitor.',
            '#c084fc'
        );
        refreshPlayerViewStatus();
    } catch (error) {
        addChatMessage('Erro', `Nao foi possivel abrir a Tela do Jogador: ${error.message || error}`, '#ef4444');
        updatePlayerViewStatusCard({ open: false });
    }
}

function syncPlayerViewNow(showMessage = false) {
    if (isPlayerView || !window.api?.syncBoard || !window.phaserScene) return false;
    const state = typeof window.getPlayerSafeBoardState === 'function'
        ? window.getPlayerSafeBoardState()
        : window.phaserScene.getBoardState();
    if (!state) return false;

    window.api.syncBoard(state);
    window.playerViewStatus.lastSyncAt = new Date().toISOString();
    window.playerViewStatus.sceneName = state.sceneName || state.sceneDirector?.sceneName || window.playerViewStatus.sceneName || '';
    updatePlayerViewStatusCard(window.playerViewStatus);
    if (showMessage) addChatMessage('Sistema', 'Mesa sincronizada com a tela dos jogadores.', '#e879f9');
    return true;
}

function forceSyncToPlayer() {
    syncPlayerViewNow(true);
    refreshPlayerViewStatus();
}

function syncPlayerViewDebounced() {
    if (isPlayerView || !window.api?.syncBoard || !window.phaserScene) return;
    clearTimeout(window.__playerSyncTimer);
    window.__playerSyncTimer = setTimeout(() => {
        syncPlayerViewNow(false);
        refreshPlayerViewStatus();
    }, 250);
}

function formatPlayerSyncTime(value) {
    if (!value) return 'nunca';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'nunca';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getPlayerSceneName() {
    return window.playerViewStatus.sceneName || window.currentSceneName || window.directedSceneDraft?.sceneName || 'Sem cena';
}

function ensurePlayerViewStatusCard() {
    if (isPlayerView) return null;
    let card = document.getElementById('player-view-status-card');
    if (card) return card;
    card = document.createElement('aside');
    card.id = 'player-view-status-card';
    card.className = 'player-view-status-card';
    document.body.appendChild(card);
    return card;
}

function updatePlayerViewStatusCard(status = {}) {
    if (isPlayerView) return;
    window.playerViewStatus = { ...window.playerViewStatus, ...status };
    const card = ensurePlayerViewStatusCard();
    if (!card) return;

    const current = window.playerViewStatus;
    const handoutTitle = current.handout?.title || current.handout?.path?.split(/[\\/]/).pop() || 'nenhum';
    card.innerHTML = `
        <header>
            <strong>Visao dos Jogadores</strong>
            <span class="${current.open ? 'is-online' : 'is-offline'}">${current.open ? 'aberta' : 'fechada'}</span>
        </header>
        <dl>
            <div><dt>Ultimo sync</dt><dd>${formatPlayerSyncTime(current.lastSyncAt)}</dd></div>
            <div><dt>Cena</dt><dd>${escapePlayerHtml(getPlayerSceneName())}</dd></div>
            <div><dt>Handout</dt><dd>${escapePlayerHtml(handoutTitle)}</dd></div>
        </dl>
        <div class="player-view-status-card__actions">
            <button type="button" data-player-status-action="sync" title="Sincronizar agora"><i class="fas fa-eye"></i></button>
            <button type="button" data-player-status-action="open" title="Reabrir tela"><i class="fas fa-users-viewfinder"></i></button>
            <button type="button" data-player-status-action="hide-handout" title="Fechar handout"><i class="fas fa-times"></i></button>
        </div>
    `;
}

async function refreshPlayerViewStatus() {
    if (isPlayerView || !window.api?.getPlayerViewStatus) return;
    try {
        updatePlayerViewStatusCard(await window.api.getPlayerViewStatus());
    } catch (error) {
        updatePlayerViewStatusCard({ open: false });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (isPlayerView) return;
    updatePlayerViewStatusCard(window.playerViewStatus);
    refreshPlayerViewStatus();
    setInterval(refreshPlayerViewStatus, 5000);
    document.addEventListener('click', event => {
        const action = event.target.closest('[data-player-status-action]')?.dataset.playerStatusAction;
        if (!action) return;
        if (action === 'sync') forceSyncToPlayer();
        if (action === 'open') openPlayerScreen();
        if (action === 'hide-handout') window.hideHandoutFromPlayers?.();
    });
});

window.openPlayerScreen = openPlayerScreen;
window.forceSyncToPlayer = forceSyncToPlayer;
window.syncPlayerViewDebounced = syncPlayerViewDebounced;
window.syncPlayerViewNow = syncPlayerViewNow;
window.updatePlayerViewStatusCard = updatePlayerViewStatusCard;
