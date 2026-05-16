// --- SISTEMA DE ANOTACOES PRO (NOTEBOOK) ---
let campaignNotes = [];
let currentEditingNoteIndex = -1;
let notasPastasAbertas = {};
let notesViewMode = localStorage.getItem('notes-view') || 'grid';

const NOTE_TYPES = ['Cena', 'NPC', 'Local', 'Pista', 'Tesouro', 'Faccao', 'Segredo', 'Sessao', 'Sistema'];
const UNASSIGNED_SCENE_ID = 'campaign';

function createNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNote(note) {
    note = note || {};
    const now = new Date().toISOString();
    const content = note.content ?? note.body ?? '';
    const tags = Array.isArray(note.tags)
        ? note.tags
        : String(note.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
    const sceneId = note.sceneId || (note.sceneName ? createSceneId(note.sceneName) : null);

    return {
        id: note.id || createNoteId(),
        title: note.title || 'Sem Titulo',
        content,
        body: content,
        category: note.category || note.type || 'Geral',
        type: note.type || note.category || 'Cena',
        tags,
        sceneId,
        sceneName: note.sceneName || null,
        characterId: note.characterId || null,
        isPinned: Boolean(note.isPinned),
        isRevealed: Boolean(note.isRevealed),
        isArchived: Boolean(note.isArchived),
        createdAt: note.createdAt || now,
        updatedAt: note.updatedAt || now
    };
}

function createSceneId(name) {
    const value = String(name || '').trim();
    if (!value) return UNASSIGNED_SCENE_ID;
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || UNASSIGNED_SCENE_ID;
}

function getCurrentSceneName() {
    return window.currentSceneName
        || window.directedSceneDraft?.sceneName
        || document.getElementById('director-scene-name')?.value
        || '';
}

function getCurrentSceneId() {
    return window.currentSceneId
        || createSceneId(getCurrentSceneName())
        || UNASSIGNED_SCENE_ID;
}

function noteBelongsToScene(note, sceneId = getCurrentSceneId()) {
    return !note.sceneId || note.sceneId === sceneId || sceneId === UNASSIGNED_SCENE_ID;
}

function getScenePinnedNotes(sceneId = getCurrentSceneId()) {
    return campaignNotes.filter(note => note.isPinned && !note.isArchived && noteBelongsToScene(note, sceneId));
}

function getSceneRevealedNotes(sceneId = getCurrentSceneId()) {
    return campaignNotes.filter(note => note.isRevealed && !note.isArchived && noteBelongsToScene(note, sceneId));
}

function buildNotePayload(note) {
    return {
        id: note.id,
        title: note.title,
        type: note.type,
        tags: note.tags || [],
        sceneId: note.sceneId || null,
        sceneName: note.sceneName || null,
        characterId: note.characterId || null,
        isPinned: Boolean(note.isPinned),
        isRevealed: Boolean(note.isRevealed),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        content: note.content,
        body: note.content
    };
}

function getSceneAwareNotesState(sceneId = getCurrentSceneId()) {
    return {
        sceneId,
        sceneName: getCurrentSceneName(),
        pinnedNotes: getScenePinnedNotes(sceneId).map(buildNotePayload),
        revealedNotes: getSceneRevealedNotes(sceneId).map(buildNotePayload)
    };
}

function syncNotesGlobals() {
    campaignNotes = campaignNotes.map(normalizeNote);
    window.campaignNotes = campaignNotes;
    window.pinnedNotes = getScenePinnedNotes();
    window.getSceneAwareNotesState = getSceneAwareNotesState;
}

function persistNotes() {
    syncNotesGlobals();
    if (window.api) window.api.saveNote(JSON.stringify(campaignNotes));
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
}

function getEditorNoteDraft(existing = {}) {
    const now = new Date().toISOString();
    const typeEl = document.getElementById('note-type');
    const tagsEl = document.getElementById('note-tags');
    const sceneEl = document.getElementById('note-scene-id');
    const characterEl = document.getElementById('note-character-id');
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    const content = document.getElementById('note-body').innerHTML;
    const sceneId = sceneEl ? sceneEl.value.trim() : existing.sceneId;
    const sceneName = sceneId === getCurrentSceneId() ? getCurrentSceneName() : existing.sceneName;

    return normalizeNote({
        ...existing,
        title: document.getElementById('note-title').value || 'Sem Titulo',
        category: document.getElementById('note-category').value || 'Geral',
        type: typeEl ? typeEl.value : existing.type,
        tags: tagsEl ? tagsEl.value : existing.tags,
        sceneId: sceneId || null,
        sceneName: sceneName || null,
        characterId: characterEl ? characterEl.value.trim() || null : existing.characterId,
        content,
        body: content,
        isPinned: pinnedEl ? pinnedEl.checked : existing.isPinned,
        isRevealed: revealedEl ? revealedEl.checked : existing.isRevealed,
        updatedAt: now
    });
}

function toggleNotesView() {
    notesViewMode = notesViewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('notes-view', notesViewMode);
    renderNotesList();
}

function toggleNotaPasta(categoria) {
    notasPastasAbertas[categoria] = !notasPastasAbertas[categoria];
    renderNotesList();
}

function renderNotesList() {
    syncNotesGlobals();
    const list = document.getElementById('notes-list');
    if (!list) return;
    const searchInput = document.getElementById('search-note');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    const btnIcon = document.querySelector('#btn-notes-view i');
    if (btnIcon) btnIcon.className = notesViewMode === 'grid' ? 'fas fa-th-large' : 'fas fa-list';
    list.className = notesViewMode === 'grid' ? 'notes-grid' : 'notes-list-mode';

    const visibleNotes = campaignNotes
        .map((note, index) => ({ note, index }))
        .filter(({ note }) => !note.isArchived)
        .filter(({ note }) => {
            const haystack = [
                note.title,
                note.content,
                note.category,
                note.type,
                ...(note.tags || [])
            ].join(' ').toLowerCase();
            return term === '' || haystack.includes(term);
        });

    if (campaignNotes.length === 0) {
        list.innerHTML = '<div class="notes-empty">O diario esta vazio. Comece a escrever.</div>';
        return;
    }

    if (visibleNotes.length === 0) {
        list.innerHTML = `<div class="notes-empty">Nenhuma anotacao encontrada para "${term}".</div>`;
        return;
    }

    const grupos = {};
    visibleNotes.forEach(item => {
        const cat = item.note.category || 'Geral';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(item);
    });

    let html = '';
    for (const cat of Object.keys(grupos).sort()) {
        if (notasPastasAbertas[cat] === undefined) notasPastasAbertas[cat] = false;
        const aberta = term !== '' ? true : notasPastasAbertas[cat];
        const icone = aberta ? 'fa-folder-open' : 'fa-folder';

        html += `
            <button class="folder-card note-folder-card" data-note-action="toggle-folder" data-category="${cat}">
                <i class="fas ${icone} folder-icon"></i>
                <span class="note-folder-title">${cat}</span>
                <span class="note-folder-count">${grupos[cat].length} itens</span>
            </button>
        `;

        if (!aberta) continue;

        html += '<div class="note-folder-items">';
        grupos[cat].forEach(({ note, index }) => {
            const previewText = stripHtml(note.content).substring(0, 80) || 'Sem conteudo...';
            const tagHtml = (note.tags || []).slice(0, 3).map(tag => `<span class="note-tag">${tag}</span>`).join('');
            html += `
                <article class="note-card" data-note-index="${index}">
                    <div class="note-card__head">
                        <span class="note-type">${note.type || 'Cena'}</span>
                        <span class="note-state">
                            ${note.isPinned ? '<i class="fas fa-thumbtack" title="Fixada"></i>' : ''}
                            ${note.isRevealed ? '<i class="fas fa-eye" title="Revelada"></i>' : ''}
                        </span>
                    </div>
                    <h4 class="note-card__title">${note.title}</h4>
                    <p class="note-card__preview">${previewText}</p>
                    <div class="note-tags">${tagHtml}</div>
                    <div class="note-actions">
                        <button class="ui-icon-btn" data-note-action="pin" data-note-index="${index}" title="Fixar na cena atual"><i class="fas fa-thumbtack"></i></button>
                        <button class="ui-icon-btn" data-note-action="share" data-note-index="${index}" title="Mostrar aos jogadores"><i class="fas fa-share-alt"></i></button>
                        <button class="ui-icon-btn" data-note-action="duplicate" data-note-index="${index}" title="Duplicar"><i class="fas fa-copy"></i></button>
                        <button class="ui-icon-btn note-danger" data-note-action="delete" data-note-index="${index}" title="Apagar"><i class="fas fa-trash"></i></button>
                    </div>
                </article>
            `;
        });
        html += '</div>';
    }
    list.innerHTML = html;
}

function shareNote(index, e) {
    if (e) e.stopPropagation();
    const note = campaignNotes[index];
    if (!note) return;
    if (!note.sceneId) {
        note.sceneId = getCurrentSceneId();
        note.sceneName = getCurrentSceneName() || note.sceneName;
    }
    note.isRevealed = true;
    note.updatedAt = new Date().toISOString();
    persistNotes();

    const payload = buildNotePayload(note);

    if (window.api && window.api.syncBoard) {
        window.api.syncBoard({ type: 'show-note', note: payload });
        addChatMessage('Sistema', `Anotacao "<strong>${note.title}</strong>" enviada aos jogadores.`, '#38bdf8');
    } else {
        addChatMessage('Sistema', `<strong>${note.title}</strong>: ${stripHtml(note.content)}`, '#38bdf8');
    }
    renderNotesList();
}

function shareCurrentEditorDraft(event) {
    if (currentEditingNoteIndex === -1) {
        const note = getEditorNoteDraft({});
        campaignNotes.push(note);
        currentEditingNoteIndex = campaignNotes.length - 1;
        persistNotes();
    } else {
        campaignNotes[currentEditingNoteIndex] = getEditorNoteDraft(campaignNotes[currentEditingNoteIndex]);
        persistNotes();
    }
    shareNote(currentEditingNoteIndex, event);
}

function createNewNote() {
    currentEditingNoteIndex = -1;
    document.getElementById('note-title').value = '';
    document.getElementById('note-category').value = 'Geral';
    document.getElementById('note-body').innerHTML = '';
    const typeEl = document.getElementById('note-type');
    const tagsEl = document.getElementById('note-tags');
    const sceneEl = document.getElementById('note-scene-id');
    const characterEl = document.getElementById('note-character-id');
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    if (typeEl) typeEl.value = 'Cena';
    if (tagsEl) tagsEl.value = '';
    if (sceneEl) sceneEl.value = '';
    if (characterEl) characterEl.value = '';
    if (pinnedEl) pinnedEl.checked = false;
    if (revealedEl) revealedEl.checked = false;
    document.getElementById('notes-list-view').classList.add('hidden');
    document.getElementById('note-editor-view').classList.remove('hidden');
}

function editNote(index) {
    currentEditingNoteIndex = index;
    const note = normalizeNote(campaignNotes[index]);
    campaignNotes[index] = note;
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-category').value = note.category;
    document.getElementById('note-body').innerHTML = note.content;
    const typeEl = document.getElementById('note-type');
    const tagsEl = document.getElementById('note-tags');
    const sceneEl = document.getElementById('note-scene-id');
    const characterEl = document.getElementById('note-character-id');
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    if (typeEl) typeEl.value = note.type;
    if (tagsEl) tagsEl.value = (note.tags || []).join(', ');
    if (sceneEl) sceneEl.value = note.sceneId || '';
    if (characterEl) characterEl.value = note.characterId || '';
    if (pinnedEl) pinnedEl.checked = note.isPinned;
    if (revealedEl) revealedEl.checked = note.isRevealed;
    document.getElementById('notes-list-view').classList.add('hidden');
    document.getElementById('note-editor-view').classList.remove('hidden');
}

function saveCurrentNote() {
    const existing = currentEditingNoteIndex >= 0 ? campaignNotes[currentEditingNoteIndex] : {};
    const note = getEditorNoteDraft(existing);

    if (currentEditingNoteIndex === -1) campaignNotes.push(note);
    else campaignNotes[currentEditingNoteIndex] = note;

    persistNotes();
    closeNoteEditor();
}

function closeNoteEditor() {
    document.getElementById('note-editor-view').classList.add('hidden');
    document.getElementById('notes-list-view').classList.remove('hidden');
    renderNotesList();
}

function deleteNote(e, index) {
    if (e) e.stopPropagation();
    if (confirm('Deseja apagar esta anotacao para sempre?')) {
        campaignNotes.splice(index, 1);
        persistNotes();
        renderNotesList();
    }
}

function togglePinNote(index) {
    const note = campaignNotes[index];
    if (!note) return;
    const sceneId = getCurrentSceneId();
    const pinnedToCurrentScene = note.isPinned && noteBelongsToScene(note, sceneId);
    note.isPinned = !pinnedToCurrentScene;
    if (note.isPinned) {
        note.sceneId = sceneId;
        note.sceneName = getCurrentSceneName() || note.sceneName;
    }
    note.updatedAt = new Date().toISOString();
    persistNotes();
    renderNotesList();
    if (typeof renderDirectorPinnedNotes === 'function') renderDirectorPinnedNotes();
}

function pinCurrentEditorDraft() {
    const sceneEl = document.getElementById('note-scene-id');
    const pinnedEl = document.getElementById('note-pinned');
    if (sceneEl) sceneEl.value = getCurrentSceneId();
    if (pinnedEl) pinnedEl.checked = true;
    if (currentEditingNoteIndex >= 0) {
        const note = campaignNotes[currentEditingNoteIndex];
        note.sceneId = getCurrentSceneId();
        note.sceneName = getCurrentSceneName() || note.sceneName;
        note.isPinned = true;
        note.updatedAt = new Date().toISOString();
        persistNotes();
        if (typeof renderDirectorPinnedNotes === 'function') renderDirectorPinnedNotes();
    }
}

function duplicateNote(index) {
    const note = campaignNotes[index];
    if (!note) return;
    campaignNotes.splice(index + 1, 0, normalizeNote({
        ...note,
        id: createNoteId(),
        title: `${note.title} (copia)`,
        isRevealed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    persistNotes();
    renderNotesList();
}

function archiveNote(index) {
    const note = campaignNotes[index];
    if (!note) return;
    note.isArchived = true;
    note.updatedAt = new Date().toISOString();
    persistNotes();
    closeNoteEditor();
}

function handleNotesClick(event) {
    const actionEl = event.target.closest('[data-note-action]');
    if (actionEl) {
        event.stopPropagation();
        const action = actionEl.dataset.noteAction;
        const index = parseInt(actionEl.dataset.noteIndex);
        if (action === 'toggle-folder') return toggleNotaPasta(actionEl.dataset.category);
        if (action === 'pin') return togglePinNote(index);
        if (action === 'share') return shareNote(index, event);
        if (action === 'duplicate') return duplicateNote(index);
        if (action === 'delete') return deleteNote(event, index);
        if (action === 'archive-current') return archiveNote(currentEditingNoteIndex);
        if (action === 'duplicate-current') return duplicateNote(currentEditingNoteIndex);
        if (action === 'share-current') return shareCurrentEditorDraft(event);
        if (action === 'pin-current') return pinCurrentEditorDraft();
    }

    const card = event.target.closest('.note-card');
    if (card) editNote(parseInt(card.dataset.noteIndex));
}

async function loadCampaignNotes() {
    if (window.api && window.api.loadNote) {
        try {
            const notasSalvas = await window.api.loadNote();
            if (notasSalvas && notasSalvas.trim() !== '') {
                const parsed = JSON.parse(notasSalvas);
                const rawNotes = Array.isArray(parsed)
                    ? parsed
                    : Array.isArray(parsed.notes)
                        ? parsed.notes
                        : Object.values(parsed || {});
                campaignNotes = rawNotes.filter(note => note && typeof note === 'object').map(normalizeNote);
            }
        } catch(e) {
            console.error('Erro ao carregar notas', e);
        }
    }
    syncNotesGlobals();
    renderNotesList();
}

window.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('notes-list');
    const editor = document.getElementById('note-editor-view');
    if (list) list.addEventListener('click', handleNotesClick);
    if (editor) editor.addEventListener('click', handleNotesClick);

    const typeEl = document.getElementById('note-type');
    if (typeEl && typeEl.children.length === 0) {
        typeEl.innerHTML = NOTE_TYPES.map(type => `<option value="${type}">${type}</option>`).join('');
    }

    loadCampaignNotes();
});

function setCurrentSceneContext(sceneName, sceneId) {
    window.currentSceneName = sceneName || '';
    window.currentSceneId = sceneId || createSceneId(sceneName);
    syncNotesGlobals();
    renderNotesList();
    if (typeof renderDirectorPinnedNotes === 'function') renderDirectorPinnedNotes();
}

function restoreSceneNotesFromBoardState(state) {
    if (!state) return;
    setCurrentSceneContext(state.sceneName || state.sceneDirector?.sceneName || '', state.sceneId);
    const incoming = [
        ...(Array.isArray(state.pinnedNotes) ? state.pinnedNotes : []),
        ...(Array.isArray(state.revealedNotes) ? state.revealedNotes : []),
        ...(Array.isArray(state.sceneNotes) ? state.sceneNotes : []),
        ...(Array.isArray(state.sceneDirector?.pinnedNotes) ? state.sceneDirector.pinnedNotes : [])
    ];
    if (incoming.length === 0) return;

    incoming.forEach(rawNote => {
        const note = normalizeNote(rawNote);
        const existingIndex = campaignNotes.findIndex(item => item.id === note.id);
        if (existingIndex >= 0) {
            campaignNotes[existingIndex] = normalizeNote({
                ...campaignNotes[existingIndex],
                sceneId: note.sceneId || getCurrentSceneId(),
                sceneName: note.sceneName || getCurrentSceneName(),
                isPinned: campaignNotes[existingIndex].isPinned || note.isPinned,
                isRevealed: campaignNotes[existingIndex].isRevealed || note.isRevealed,
                updatedAt: campaignNotes[existingIndex].updatedAt || note.updatedAt
            });
        } else {
            campaignNotes.push(note);
        }
    });
    persistNotes();
}

function revealNoteById(noteId) {
    const index = campaignNotes.findIndex(note => note.id === noteId);
    if (index >= 0) shareNote(index);
}

function unpinNoteById(noteId) {
    const note = campaignNotes.find(item => item.id === noteId);
    if (!note) return;
    note.isPinned = false;
    note.updatedAt = new Date().toISOString();
    persistNotes();
    renderNotesList();
    if (typeof renderDirectorPinnedNotes === 'function') renderDirectorPinnedNotes();
}
