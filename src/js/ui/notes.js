// --- SISTEMA DE ANOTACOES PRO (NOTEBOOK) ---
let campaignNotes = [];
let currentEditingNoteIndex = -1;
let notasPastasAbertas = {};
let notesViewMode = localStorage.getItem('notes-view') || 'grid';

const NOTE_TYPES = ['Cena', 'NPC', 'Local', 'Pista', 'Tesouro', 'Faccao', 'Segredo', 'Sessao', 'Sistema'];

function createNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNote(note) {
    const now = new Date().toISOString();
    const content = note.content ?? note.body ?? '';
    const tags = Array.isArray(note.tags)
        ? note.tags
        : String(note.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);

    return {
        id: note.id || createNoteId(),
        title: note.title || 'Sem Titulo',
        content,
        body: content,
        category: note.category || note.type || 'Geral',
        type: note.type || note.category || 'Cena',
        tags,
        sceneId: note.sceneId || null,
        characterId: note.characterId || null,
        isPinned: Boolean(note.isPinned),
        isRevealed: Boolean(note.isRevealed),
        isArchived: Boolean(note.isArchived),
        createdAt: note.createdAt || now,
        updatedAt: note.updatedAt || now
    };
}

function syncNotesGlobals() {
    campaignNotes = campaignNotes.map(normalizeNote);
    window.campaignNotes = campaignNotes;
    window.pinnedNotes = campaignNotes.filter(note => note.isPinned && !note.isArchived);
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
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    const content = document.getElementById('note-body').innerHTML;

    return normalizeNote({
        ...existing,
        title: document.getElementById('note-title').value || 'Sem Titulo',
        category: document.getElementById('note-category').value || 'Geral',
        type: typeEl ? typeEl.value : existing.type,
        tags: tagsEl ? tagsEl.value : existing.tags,
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
                        <button class="ui-icon-btn" data-note-action="pin" data-note-index="${index}" title="Fixar na cena"><i class="fas fa-thumbtack"></i></button>
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
    note.isRevealed = true;
    note.updatedAt = new Date().toISOString();
    persistNotes();

    const payload = {
        id: note.id,
        title: note.title,
        type: note.type,
        content: note.content,
        tags: note.tags
    };

    if (window.api && window.api.syncBoard) {
        window.api.syncBoard({ type: 'show-note', note: payload });
        addChatMessage('Sistema', `Anotacao "<strong>${note.title}</strong>" enviada aos jogadores.`, '#38bdf8');
    } else {
        addChatMessage('Sistema', `<strong>${note.title}</strong>: ${stripHtml(note.content)}`, '#38bdf8');
    }
    renderNotesList();
}

function createNewNote() {
    currentEditingNoteIndex = -1;
    document.getElementById('note-title').value = '';
    document.getElementById('note-category').value = 'Geral';
    document.getElementById('note-body').innerHTML = '';
    const typeEl = document.getElementById('note-type');
    const tagsEl = document.getElementById('note-tags');
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    if (typeEl) typeEl.value = 'Cena';
    if (tagsEl) tagsEl.value = '';
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
    const pinnedEl = document.getElementById('note-pinned');
    const revealedEl = document.getElementById('note-revealed');
    if (typeEl) typeEl.value = note.type;
    if (tagsEl) tagsEl.value = (note.tags || []).join(', ');
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
    note.isPinned = !note.isPinned;
    note.updatedAt = new Date().toISOString();
    persistNotes();
    renderNotesList();
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
        if (action === 'share-current') return shareNote(currentEditingNoteIndex, event);
    }

    const card = event.target.closest('.note-card');
    if (card) editNote(parseInt(card.dataset.noteIndex));
}

async function loadCampaignNotes() {
    if (window.api && window.api.loadNote) {
        try {
            const notasSalvas = await window.api.loadNote();
            if (notasSalvas && notasSalvas.trim() !== '') {
                campaignNotes = JSON.parse(notasSalvas).map(normalizeNote);
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
