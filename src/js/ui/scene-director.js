// Scene Director: lightweight session orchestration built on existing VTT APIs.
let directedSceneDraft = {};
let directorAssets = {
    maps: [],
    audios: [],
    handouts: []
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

function directorOption(item) {
    return `<option value="${item.path.replace(/\\/g, '/')}">${item.name.replace(/\.[^/.]+$/, '')}</option>`;
}

function populateDirectorSelects() {
    const mapEl = getDirectorEl('director-map');
    const audioEl = getDirectorEl('director-audio');
    const handoutEl = getDirectorEl('director-handout');
    if (mapEl) mapEl.innerHTML = '<option value="">Manter mapa atual</option>' + directorAssets.maps.map(directorOption).join('');
    if (audioEl) audioEl.innerHTML = '<option value="">Sem musica vinculada</option>' + directorAssets.audios.map(directorOption).join('');
    if (handoutEl) handoutEl.innerHTML = '<option value="">Sem handout</option>' + directorAssets.handouts.map(directorOption).join('');
    applyDirectedSceneDraftToUI(directedSceneDraft);
}

function renderDirectorPinnedNotes() {
    const container = getDirectorEl('director-pinned-notes');
    if (!container) return;
    const notes = (window.pinnedNotes || []).filter(note => !note.isArchived);
    if (notes.length === 0) {
        container.innerHTML = '<div class="director-empty">Nenhuma nota fixada ainda.</div>';
        return;
    }

    container.innerHTML = notes.map(note => `
        <div class="director-note-item">
            <strong>${note.title || 'Nota'}</strong>
            <span>${note.type || 'Nota'}${note.tags?.length ? ' / ' + note.tags.join(', ') : ''}</span>
        </div>
    `).join('');
}

async function refreshSceneDirector() {
    if (!window.api) return;
    const [maps, audios, images, videos] = await Promise.all([
        window.api.getMaps ? window.api.getMaps() : [],
        window.api.getAudio ? window.api.getAudio() : [],
        window.api.getImages ? window.api.getImages() : [],
        window.api.getVideos ? window.api.getVideos() : []
    ]);
    directorAssets = {
        maps: maps || [],
        audios: audios || [],
        handouts: [...(images || []), ...(videos || [])]
    };
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
    }
    applyDirectorWeather(draft.weather);
    renderDirectorPinnedNotes();
    addChatMessage('Diretor de Cena', `Cena preparada: <strong>${draft.sceneName || 'Sem nome'}</strong>.`, '#fbbf24');
}

function startDirectedScene() {
    prepareDirectedScene();
    playDirectorMusic();
    showDirectorIntroToPlayers();
    syncDirectorSceneToPlayers();
}

function playDirectorMusic() {
    saveDirectedSceneDraft();
    const draft = directedSceneDraft;
    if (!draft.audioPath) return;
    const name = draft.audioPath.split(/[\\/]/).pop();
    if (typeof playMusic === 'function') playMusic(draft.audioPath, name);
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
        if (typeof rememberRevealedHandout === 'function') rememberRevealedHandout(payload);
    }
    addChatMessage('Diretor de Cena', 'Introducao/handout enviados para a visao dos jogadores.', '#38bdf8');
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
        const state = window.phaserScene.getBoardState();
        state.sceneDirector = {
            ...directedSceneDraft,
            pinnedNotes: window.pinnedNotes || []
        };
        window.api.syncBoard(state);
        addChatMessage('Diretor de Cena', 'Cena sincronizada com os jogadores.', '#e879f9');
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
    addChatMessage('Diretor de Cena', `Cena encerrada: <strong>${directedSceneDraft.sceneName || 'Sem nome'}</strong>.`, '#ef4444');
}

document.addEventListener('DOMContentLoaded', () => {
    loadDirectedSceneDraft();
    refreshSceneDirector();
    document.querySelectorAll('#director-content input, #director-content textarea, #director-content select').forEach(el => {
        el.addEventListener('change', saveDirectedSceneDraft);
        el.addEventListener('input', saveDirectedSceneDraft);
    });
});
