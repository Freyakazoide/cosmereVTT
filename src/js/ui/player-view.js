// Lógica para detectar se esta janela é a do Jogador ou a do Mestre
const isPlayerView = window.location.search.includes('player=true');

if (isPlayerView) {
    // Se for jogador, esconde tudo de GM na inicialização
    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('sidebar');
        const toolsBar = document.querySelector('.tools-bar');
        const btnToggle = document.getElementById('btn-toggle-menu');
        const btnHelp = document.getElementById('btn-help');
        
        if(sidebar) sidebar.style.display = 'none';
        if(toolsBar) toolsBar.style.display = 'none';
        if(btnToggle) btnToggle.style.display = 'none';
        if(btnHelp) btnHelp.style.display = 'none';
        document.body.classList.add('player-view');
    });

    // Escuta pacotes de sincronização mandados pelo Mestre
    if (window.api && window.api.onUpdateBoard) {
        window.api.onUpdateBoard((state) => {
            if (state && state.type === 'show-note') {
                renderPlayerNote(state.note);
                return;
            }

            if (window.phaserScene) {
                window.phaserScene.loadBoardState(state);
                renderPlayerSceneNotes(state);
                if (state.weather) window.phaserScene.setAdvancedWeather(state.weather);
                if (state.drawings && state.drawings.length > 0) {
                    state.drawings.forEach(d => {
                        const g = window.phaserScene.add.graphics();
                        g.fillStyle(d.color, 0.6);
                        g.fillRect(d.x, d.y, d.w, d.h);
                        window.phaserScene.camadaTatico.add(g);
                    });
                }
            }
        });
    }

    if (window.api && window.api.onPing) {
        window.api.onPing((payload) => {
            renderPlayerPing(payload);
        });
    }

    if (window.api && window.api.onShowHandout) {
        window.api.onShowHandout((payload) => {
            renderPlayerHandout(payload);
        });
    }

    if (window.api && window.api.onHideHandout) {
        window.api.onHideHandout(() => {
            hidePlayerHandout();
        });
    }
}

function renderPlayerPing(payload) {
    if (!window.phaserScene || !payload) return;
    const scene = window.phaserScene;
    const ping = scene.add.graphics();
    ping.lineStyle(5, 0xfbbf24, 1);
    ping.strokeCircle(0, 0, 18);
    ping.setPosition(payload.x, payload.y);
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

function renderPlayerHandout(payload) {
    if (!payload || !payload.path) return;
    hidePlayerHandout();

    const overlay = document.createElement('div');
    overlay.className = 'player-handout-overlay';
    const isVideo = /\.(mp4|webm|ogg)$/i.test(payload.path);
    overlay.innerHTML = `
        <div class="player-handout-card">
            ${isVideo
                ? `<video src="file://${payload.path}" controls autoplay></video>`
                : `<img src="file://${payload.path}" alt="${payload.title || 'Handout'}">`
            }
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
}

function hidePlayerHandout() {
    const existing = document.querySelector('.player-handout-overlay');
    if (existing) existing.remove();
}

function renderPlayerNote(note) {
    if (!note) return;
    const existing = document.querySelector('.player-note-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'player-note-overlay';
    const tags = (note.tags || []).map(tag => `<span>${tag}</span>`).join('');
    overlay.innerHTML = `
        <article class="player-note-card">
            <div class="player-note-card__type">${note.type || 'Nota'}</div>
            <h2>${note.title || 'Nota Revelada'}</h2>
            <div class="player-note-card__body">${note.content || note.body || ''}</div>
            <div class="player-note-card__tags">${tags}</div>
        </article>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
}

function renderPlayerSceneNotes(state) {
    const existing = document.querySelector('.player-scene-notes');
    if (existing) existing.remove();
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
        <div class="player-scene-notes__title">${state.sceneName || state.sceneDirector?.sceneName || 'Cena'}</div>
        ${uniqueNotes.map(note => `
            <button class="player-scene-note" data-note-id="${note.id}">
                <span>${note.type || 'Nota'}</span>
                <strong>${note.title || 'Nota Revelada'}</strong>
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

function openPlayerScreen() {
    if (window.api && window.api.openPlayerView) {
        window.api.openPlayerView();
        addChatMessage('Sistema', 'Tela de Jogador lançada. Arraste para o segundo monitor.', '#c084fc');
    }
}

        function forceSyncToPlayer() {
            if (!isPlayerView && window.api && window.api.syncBoard && window.phaserScene) {
                window.api.syncBoard(window.phaserScene.getBoardState());
                addChatMessage('Sistema', 'Mesa sincronizada com a tela dos jogadores.', '#e879f9');
            }
        }
