(function initSessionTimeline() {
    const SESSION_STORAGE_KEY = 'cosmere_session_timeline_state';

    const SESSION_EVENT_TYPES = {
        SESSION_STARTED: 'session_started',
        SESSION_ENDED: 'session_ended',
        SCENE_PREPARED: 'scene_prepared',
        SCENE_STARTED: 'scene_started',
        SCENE_ENDED: 'scene_ended',
        MAP_LOADED: 'map_loaded',
        MUSIC_STARTED: 'music_started',
        HANDOUT_REVEALED: 'handout_revealed',
        NOTE_REVEALED: 'note_revealed',
        COMBAT_STARTED: 'combat_started',
        COMBAT_ENDED: 'combat_ended',
        TURN_CHANGED: 'turn_changed',
        DAMAGE_APPLIED: 'damage_applied',
        HEAL_APPLIED: 'heal_applied',
        CONDITION_ADDED: 'condition_added',
        CONDITION_REMOVED: 'condition_removed'
    };

    function getDefaultSessionState() {
        return {
            active: false,
            sessionName: '',
            startedAt: null,
            endedAt: null,
            events: []
        };
    }

    function normalizeSessionState(state) {
        return {
            ...getDefaultSessionState(),
            ...(state || {}),
            events: Array.isArray(state?.events) ? state.events : []
        };
    }

    function loadPersistedSessionState() {
        try {
            const saved = localStorage.getItem(SESSION_STORAGE_KEY);
            return saved ? normalizeSessionState(JSON.parse(saved)) : null;
        } catch (error) {
            console.warn('Nao foi possivel restaurar a linha do tempo da sessao.', error);
            return null;
        }
    }

    function persistSessionState() {
        try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ensureSessionState()));
        } catch (error) {
            console.warn('Nao foi possivel salvar a linha do tempo da sessao.', error);
        }
    }

    function restoreSessionState(state, options = {}) {
        window.sessionState = normalizeSessionState(state);
        if (options.persist !== false) {
            persistSessionState();
        }
        if (typeof renderSessionTimeline === 'function') {
            renderSessionTimeline();
        }
        return window.sessionState;
    }

    function getSessionStateSnapshot() {
        return JSON.parse(JSON.stringify(ensureSessionState()));
    }

    window.SESSION_EVENT_TYPES = window.SESSION_EVENT_TYPES || SESSION_EVENT_TYPES;
    window.sessionState = normalizeSessionState(window.sessionState || loadPersistedSessionState());

    function ensureSessionState() {
        window.sessionState = normalizeSessionState(window.sessionState);
        return window.sessionState;
    }

    function addSessionEvent(type, title, description = '', meta = {}) {
        const state = ensureSessionState();
        const event = {
            id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type,
            title,
            description,
            timestamp: new Date().toISOString(),
            meta
        };

        state.events.push(event);
        persistSessionState();

        if (typeof renderSessionTimeline === 'function') {
            renderSessionTimeline();
        }

        return event;
    }

    function renderSessionTimeline() {
        const list = document.getElementById('session-timeline-list');
        const status = document.getElementById('session-status-pill');
        if (!list) return;

        const state = ensureSessionState();
        if (status) {
            status.textContent = state.active ? 'Em andamento' : 'Inativa';
        }

        if (!state.events.length) {
            list.innerHTML = `
                <div class="vtt-empty-state vtt-empty-state--library">
                    <i class="fas fa-scroll"></i>
                    <span>Nenhum evento registrado nesta sessao.</span>
                </div>
            `;
            return;
        }

        list.innerHTML = [...state.events].reverse().map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <article class="session-event session-event--${escapeSessionAttribute(event.type)}">
                    <div class="session-event__time">${time}</div>
                    <div class="session-event__body">
                        <strong>${escapeSessionHtml(event.title)}</strong>
                        ${event.description ? `<span>${escapeSessionHtml(event.description)}</span>` : ''}
                    </div>
                </article>
            `;
        }).join('');
    }

    function startSession() {
        const state = ensureSessionState();
        const name = window.currentSceneName || window.directedSceneDraft?.sceneName || 'Sessao sem nome';

        state.active = true;
        state.sessionName = name;
        state.startedAt = new Date().toISOString();
        state.endedAt = null;
        persistSessionState();

        addSessionEvent(SESSION_EVENT_TYPES.SESSION_STARTED, 'Sessao iniciada', name);
    }

    function endSession() {
        const state = ensureSessionState();
        state.active = false;
        state.endedAt = new Date().toISOString();
        persistSessionState();

        addSessionEvent(SESSION_EVENT_TYPES.SESSION_ENDED, 'Sessao encerrada', state.sessionName || '');
    }

    function generateSessionRecap() {
        const output = document.getElementById('session-recap-output');
        if (!output) return;

        const events = ensureSessionState().events;
        if (!events.length) {
            output.classList.remove('hidden');
            output.innerHTML = '<p>Nenhum evento registrado para gerar recap.</p>';
            return;
        }

        const scenes = events.filter(e => e.type === SESSION_EVENT_TYPES.SCENE_STARTED).map(e => e.description);
        const combats = events.filter(e => e.type === SESSION_EVENT_TYPES.COMBAT_STARTED).length;
        const handouts = events.filter(e => e.type === SESSION_EVENT_TYPES.HANDOUT_REVEALED).map(e => e.description);
        const damageEvents = events.filter(e => e.type === SESSION_EVENT_TYPES.DAMAGE_APPLIED);
        const conditions = events.filter(e => e.type === SESSION_EVENT_TYPES.CONDITION_ADDED);

        output.classList.remove('hidden');
        output.innerHTML = `
            <div class="session-recap-card">
                <h3>Recap da sessao</h3>
                <p><strong>Cenas jogadas:</strong> ${scenes.length ? escapeSessionHtml(scenes.join(', ')) : 'Nenhuma cena registrada.'}</p>
                <p><strong>Combates:</strong> ${combats}</p>
                <p><strong>Handouts revelados:</strong> ${handouts.length ? escapeSessionHtml(handouts.join(', ')) : 'Nenhum.'}</p>
                <p><strong>Eventos de dano:</strong> ${damageEvents.length}</p>
                <p><strong>Condicoes aplicadas:</strong> ${conditions.length}</p>
                <hr>
                <p><strong>Resumo narrativo:</strong></p>
                <p>${escapeSessionHtml(buildNarrativeRecap(events))}</p>
            </div>
        `;
    }

    function buildNarrativeRecap(events) {
        const important = events.filter(e => [
            SESSION_EVENT_TYPES.SCENE_STARTED,
            SESSION_EVENT_TYPES.HANDOUT_REVEALED,
            SESSION_EVENT_TYPES.NOTE_REVEALED,
            SESSION_EVENT_TYPES.COMBAT_STARTED,
            SESSION_EVENT_TYPES.COMBAT_ENDED,
            SESSION_EVENT_TYPES.SCENE_ENDED
        ].includes(e.type));

        return important.map(e => {
            const time = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return `${time}: ${e.title}${e.description ? ' - ' + e.description : ''}.`;
        }).join(' ');
    }

    function escapeSessionHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function escapeSessionAttribute(value) {
        return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    }

    window.addSessionEvent = addSessionEvent;
    window.renderSessionTimeline = renderSessionTimeline;
    window.startSession = startSession;
    window.endSession = endSession;
    window.generateSessionRecap = generateSessionRecap;
    window.buildNarrativeRecap = buildNarrativeRecap;
    window.getSessionStateSnapshot = getSessionStateSnapshot;
    window.restoreSessionState = restoreSessionState;
    window.persistSessionState = persistSessionState;

    document.addEventListener('DOMContentLoaded', renderSessionTimeline);
})();
