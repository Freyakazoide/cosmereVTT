// Scene Director: lightweight session orchestration built on existing VTT APIs.
let directedSceneDraft = {};
let directorAssets = {
    maps: [],
    audios: [],
    handouts: []
};
const DIRECTOR_ASSET_BUCKETS = {
    map: 'maps',
    audio: 'audios',
    image: 'handouts',
    video: 'handouts',
    handout: 'handouts'
};

function getDirectorEl(id) {
    return document.getElementById(id);
}

function getDirectedSceneDraftFromUI() {
    return {
        sceneName: getDirectorEl('director-scene-name')?.value || '',
        gmText: getDirectorEl('director-gm-text')?.value || '',
        playerText: getDirectorEl('director-player-text')?.value || '',
        mapPath: getDirectorEl('director-map')?.value || '',
        audioPath: getDirectorEl('director-audio')?.value || '',
        weather: getDirectorEl('director-weather')?.value || 'none',
        handoutPath: getDirectorEl('director-handout')?.value || '',
        objective: getDirectorEl('director-objective')?.value || '',
        victory: getDirectorEl('director-victory')?.value || '',
        failure: getDirectorEl('director-failure')?.value || '',
        updatedAt: new Date().toISOString()
    };
}

function applyDirectedSceneDraftToUI(draft) {
    if (!draft) return;
    const fields = {
        'director-scene-name': draft.sceneName,
        'director-gm-text': draft.gmText,
        'director-player-text': draft.playerText,
        'director-weather': draft.weather,
        'director-objective': draft.objective,
        'director-victory': draft.victory,
        'director-failure': draft.failure
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = getDirectorEl(id);
        if (el && value !== undefined) el.value = value;
    });

    const mapEl = getDirectorEl('director-map');
    const audioEl = getDirectorEl('director-audio');
    const handoutEl = getDirectorEl('director-handout');
    if (mapEl && draft.mapPath) mapEl.value = draft.mapPath;
    if (audioEl && draft.audioPath) audioEl.value = draft.audioPath;
    if (handoutEl && draft.handoutPath) handoutEl.value = draft.handoutPath;
}

function restoreDirectedSceneFromState(sceneDirectorState) {
    if (!sceneDirectorState) return;
    directedSceneDraft = {
        ...sceneDirectorState,
        updatedAt: sceneDirectorState.updatedAt || new Date().toISOString()
    };
    window.directedSceneDraft = directedSceneDraft;
    localStorage.setItem('cosmere_directed_scene_draft', JSON.stringify(directedSceneDraft));
    if (directorAssets.maps.length || directorAssets.audios.length || directorAssets.handouts.length) {
        applyDirectedSceneDraftToUI(directedSceneDraft);
    } else {
        refreshSceneDirector().then(() => applyDirectedSceneDraftToUI(directedSceneDraft));
    }
    renderDirectorPinnedNotes();
}

function saveDirectedSceneDraft() {
    directedSceneDraft = getDirectedSceneDraftFromUI();
    window.directedSceneDraft = directedSceneDraft;
    if (directedSceneDraft.sceneName && typeof setCurrentSceneContext === 'function') {
        setCurrentSceneContext(directedSceneDraft.sceneName);
    }
    localStorage.setItem('cosmere_directed_scene_draft', JSON.stringify(directedSceneDraft));
}

function loadDirectedSceneDraft() {
    try {
        directedSceneDraft = JSON.parse(localStorage.getItem('cosmere_directed_scene_draft') || '{}');
    } catch (error) {
        directedSceneDraft = {};
    }
    window.directedSceneDraft = directedSceneDraft;
}

function escapeDirectorText(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
}

function escapeDirectorAttr(value) {
    return escapeDirectorText(value).replace(/`/g, '&#96;');
}

function normalizeDirectorPath(value) {
    return String(value || '').replace(/\\/g, '/');
}

function getDirectorAssetName(asset) {
    const name = asset.name || asset.fileName || normalizeDirectorPath(asset.path).split('/').pop() || '';
    return String(name).replace(/\.[^/.]+$/, '');
}

function getDirectorAssetLabel(asset) {
    const name = getDirectorAssetName(asset);
    return asset.category ? `${asset.category} / ${name}` : name;
}

function directorOption(asset) {
    return `<option value="${escapeDirectorAttr(asset.path)}">${escapeDirectorText(getDirectorAssetLabel(asset))}</option>`;
}

function getUniqueDirectorAssets(assets) {
    const byPath = new Map();
    (assets || []).forEach(asset => {
        if (!asset?.path || asset.missing) return;
        const key = normalizeDirectorPath(asset.path).toLowerCase();
        if (!byPath.has(key)) byPath.set(key, asset);
    });
    return [...byPath.values()].sort((a, b) => getDirectorAssetLabel(a).localeCompare(getDirectorAssetLabel(b)));
}

function getDirectorAssetsFromLibrary(assets) {
    const nextAssets = {
        maps: [],
        audios: [],
        handouts: []
    };

    (assets || []).forEach(asset => {
        const bucket = DIRECTOR_ASSET_BUCKETS[asset?.type];
        if (bucket) nextAssets[bucket].push(asset);
    });

    return {
        maps: getUniqueDirectorAssets(nextAssets.maps),
        audios: getUniqueDirectorAssets(nextAssets.audios),
        handouts: getUniqueDirectorAssets(nextAssets.handouts)
    };
}

function populateDirectorSelects() {
    const mapEl = getDirectorEl('director-map');
    const audioEl = getDirectorEl('director-audio');
    const handoutEl = getDirectorEl('director-handout');
    if (mapEl) mapEl.innerHTML = '<option value="">Manter terreno atual</option>' + directorAssets.maps.map(directorOption).join('');
    if (audioEl) audioEl.innerHTML = '<option value="">Sem trilha vinculada</option>' + directorAssets.audios.map(directorOption).join('');
    if (handoutEl) handoutEl.innerHTML = '<option value="">Sem pergaminho</option>' + directorAssets.handouts.map(directorOption).join('');
    applyDirectedSceneDraftToUI(directedSceneDraft);
}

function renderDirectorPinnedNotes() {
    const container = getDirectorEl('director-pinned-notes');
    if (!container) return;
    const notes = (window.pinnedNotes || []).filter(note => !note.isArchived);
    if (notes.length === 0) {
        container.innerHTML = '<div class="director-empty">Nenhuma pista fixada ainda.</div>';
        return;
    }

    container.innerHTML = notes.map(note => `
        <div class="director-note-item" data-note-id="${escapeDirectorText(note.id)}">
            <strong>${escapeDirectorText(note.title || 'Pista')}</strong>
            <span>${escapeDirectorText(note.type || 'Pista')}${note.tags?.length ? ' / ' + escapeDirectorText(note.tags.join(', ')) : ''}</span>
            <div class="director-note-actions">
                <button class="ui-icon-btn" onclick="revealNoteById('${escapeDirectorText(note.id)}')" title="Revelar aos aventureiros"><i class="fas fa-scroll"></i></button>
                <button class="ui-icon-btn" onclick="unpinNoteById('${escapeDirectorText(note.id)}')" title="Remover do mural"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `).join('');
}

async function refreshSceneDirector() {
    if (!window.api?.getAssetsLibrary) return;
    const assets = await window.api.getAssetsLibrary();
    if (window.assetsLibraryState) window.assetsLibraryState.assets = assets || [];
    directorAssets = getDirectorAssetsFromLibrary(assets);
    populateDirectorSelects();
    renderDirectorPinnedNotes();
}

function applyDirectorWeather(weather) {
    if (!window.phaserScene || !window.phaserScene.setAdvancedWeather) return;
    const configs = {
        none: { ash: 0, rain: 0, sun: 0, wind: 0 },
        rain: { ash: 0, rain: 65, sun: 0, wind: 20 },
        ash: { ash: 70, rain: 0, sun: 0, wind: 18 },
        sun: { ash: 0, rain: 0, sun: 75, wind: 0 },
        storm: { ash: 0, rain: 90, sun: 0, wind: 80 }
    };
    window.phaserScene.setAdvancedWeather(configs[weather] || configs.none);
}

function prepareDirectedScene() {
    saveDirectedSceneDraft();
    const draft = directedSceneDraft;
    if (draft.mapPath && window.phaserScene) {
        const name = draft.mapPath.split(/[\\/]/).pop();
        window.phaserScene.carregarMapa(draft.mapPath, name);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('map_loaded', 'Mapa carregado', name, { mapPath: draft.mapPath });
        }
    }
    applyDirectorWeather(draft.weather);
    renderDirectorPinnedNotes();
    if (typeof window.addSessionEvent === 'function') {
        window.addSessionEvent('scene_prepared', 'Cena preparada', draft.sceneName || 'Sem nome', {
            mapPath: draft.mapPath,
            weather: draft.weather
        });
    }
    addChatMessage('Orquestrador', `Cena preparada: <strong>${draft.sceneName || 'Sem nome'}</strong>.`, '#fbbf24');
}

function startDirectedScene() {
    prepareDirectedScene();
    playDirectorMusic();
    showDirectorIntroToPlayers();
    syncDirectorSceneToPlayers();
    if (typeof window.addSessionEvent === 'function') {
        window.addSessionEvent('scene_started', 'Cena iniciada', directedSceneDraft.sceneName || 'Sem nome');
    }
}

function playDirectorMusic() {
    saveDirectedSceneDraft();
    const draft = directedSceneDraft;
    if (!draft.audioPath) return;
    const name = draft.audioPath.split(/[\\/]/).pop();
    if (typeof playMusic === 'function') playMusic(draft.audioPath, name);
    if (typeof window.addSessionEvent === 'function') {
        window.addSessionEvent('music_started', 'Trilha iniciada', name, { audioPath: draft.audioPath });
    }
}

function showDirectorIntroToPlayers() {
    saveDirectedSceneDraft();
    const draft = directedSceneDraft;
    if (draft.playerText && window.api?.syncBoard) {
        window.api.syncBoard({
            type: 'show-note',
            note: {
                id: `director_intro_${Date.now()}`,
                title: draft.sceneName || 'Introducao da Cena',
                type: 'Cena',
                content: draft.playerText,
                tags: ['Cena']
            }
        });
    }

    if (draft.handoutPath && window.api?.showHandoutToPlayers) {
        const payload = {
            type: /\.(mp4|webm|ogg)$/i.test(draft.handoutPath) ? 'video' : 'image',
            path: draft.handoutPath,
            title: draft.handoutPath.split(/[\\/]/).pop()
        };
        window.api.showHandoutToPlayers(payload);
        if (typeof window.updatePlayerViewStatusCard === 'function') window.updatePlayerViewStatusCard({ handout: payload });
        if (typeof rememberRevealedHandout === 'function') rememberRevealedHandout(payload);
    }
    if (typeof window.addSessionEvent === 'function' && (draft.playerText || draft.handoutPath)) {
        window.addSessionEvent(
            'handout_revealed',
            'Pergaminho/prologo revelado',
            draft.handoutPath ? draft.handoutPath.split(/[\\/]/).pop() : draft.sceneName || '',
            { handoutPath: draft.handoutPath, hasPlayerText: !!draft.playerText }
        );
    }
    addChatMessage('Orquestrador', 'Prologo/pergaminho enviados para a visao dos aventureiros.', '#38bdf8');
}

function closeDirectorHandoutForPlayers() {
    if (typeof hideHandoutFromPlayers === 'function') {
        hideHandoutFromPlayers();
    } else if (window.api?.hideHandoutFromPlayers) {
        window.api.hideHandoutFromPlayers();
    }
}

function syncDirectorSceneToPlayers() {
    saveDirectedSceneDraft();
    if (window.api?.syncBoard && window.phaserScene) {
        const state = typeof window.getPlayerSafeBoardState === 'function'
            ? window.getPlayerSafeBoardState()
            : window.phaserScene.getBoardState();
        state.sceneDirector = {
            ...directedSceneDraft,
            pinnedNotes: window.pinnedNotes || []
        };
        window.api.syncBoard(state);
        addChatMessage('Orquestrador', 'Cena sincronizada com os aventureiros.', '#e879f9');
    }
}

function endDirectedScene() {
    saveDirectedSceneDraft();
    if (typeof stopMusic === 'function') stopMusic();
    if (window.api?.syncBoard) {
        window.api.syncBoard({
            type: 'show-note',
            note: {
                id: `director_end_${Date.now()}`,
                title: directedSceneDraft.sceneName || 'Cena encerrada',
                type: 'Cena',
                content: 'A cena foi encerrada.',
                tags: ['Cena']
            }
        });
    }
    if (typeof window.addSessionEvent === 'function') {
        window.addSessionEvent('scene_ended', 'Cena encerrada', directedSceneDraft.sceneName || 'Sem nome');
    }
    addChatMessage('Orquestrador', `Cena encerrada: <strong>${directedSceneDraft.sceneName || 'Sem nome'}</strong>.`, '#ef4444');
}

document.addEventListener('DOMContentLoaded', () => {
    loadDirectedSceneDraft();
    refreshSceneDirector();
    document.querySelectorAll('#director-content input, #director-content textarea, #director-content select').forEach(el => {
        el.addEventListener('change', saveDirectedSceneDraft);
        el.addEventListener('input', saveDirectedSceneDraft);
    });
});
