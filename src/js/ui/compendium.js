// Wiki linking from journal/editor fields: smart double click.
document.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        const text = e.target.value;
        const pos = e.target.selectionStart;

        let start = pos;
        while (start > 0 && !/\s/.test(text[start - 1])) start--;
        let end = pos;
        while (end < text.length && !/\s/.test(text[end])) end++;

        const word = text.substring(start, end);
        if (word.startsWith('@')) {
            const nome = word.substring(1).replace(/[^a-zA-ZÀ-ÿ0-9_]/g, '');
            if (nome && window.abrirFicha) abrirFicha(nome);
        }
    }
});

(function initCompendiumSystem() {
    const COMPENDIUM_TYPES = {
        ITEM: 'item',
        WEAPON: 'weapon',
        ARMOR: 'armor',
        POWER: 'power',
        TALENT: 'talent',
        CONDITION: 'condition',
        CREATURE: 'creature',
        NPC: 'npc',
        HANDOUT: 'handout',
        SCENE: 'scene'
    };

    const TYPE_LABELS = {
        item: 'Reliquias gerais',
        weapon: 'Armas',
        armor: 'Armaduras',
        power: 'Poderes',
        talent: 'Talentos',
        condition: 'Aflicoes',
        creature: 'Ameacas',
        npc: 'NPCs',
        handout: 'Pergaminhos',
        scene: 'Cenas lendarias'
    };

    const TYPE_ICONS = {
        item: 'fa-box-open',
        weapon: 'fa-wand-sparkles',
        armor: 'fa-shield-halved',
        power: 'fa-wand-sparkles',
        talent: 'fa-star',
        condition: 'fa-skull-crossbones',
        creature: 'fa-dragon',
        npc: 'fa-user-secret',
        handout: 'fa-scroll',
        scene: 'fa-dungeon'
    };

    const MECHANIC_FIELDS = {
        weapon: [
            ['damage', 'Dano'],
            ['attribute', 'Atributo'],
            ['skill', 'Pericia'],
            ['range', 'Alcance'],
            ['weight', 'Peso'],
            ['properties', 'Propriedades']
        ],
        armor: [
            ['defense', 'Defesa'],
            ['penalty', 'Penalidade'],
            ['weight', 'Peso'],
            ['properties', 'Propriedades']
        ],
        power: [
            ['cost', 'Custo'],
            ['range', 'Alcance'],
            ['duration', 'Duracao'],
            ['test', 'Teste'],
            ['effect', 'Efeito']
        ],
        talent: [
            ['cost', 'Custo'],
            ['duration', 'Duracao'],
            ['effect', 'Efeito']
        ],
        condition: [
            ['effect', 'Efeito mecanico'],
            ['duration', 'Duracao padrao'],
            ['removeWith', 'Remove com'],
            ['icon', 'Selo visual']
        ],
        creature: [
            ['hpAtual', 'HP atual'],
            ['hpMax', 'HP maximo'],
            ['defense', 'Defesas'],
            ['attributes', 'Atributos'],
            ['attacks', 'Ataques'],
            ['tokenPath', 'Token'],
            ['behavior', 'Comportamento'],
            ['gmNotes', 'Segredos do mestre']
        ],
        npc: [
            ['hpAtual', 'HP atual'],
            ['hpMax', 'HP maximo'],
            ['defense', 'Defesas'],
            ['attributes', 'Atributos'],
            ['attacks', 'Ataques'],
            ['tokenPath', 'Token'],
            ['behavior', 'Comportamento'],
            ['gmNotes', 'Segredos do mestre']
        ],
        handout: [
            ['path', 'Pergaminho'],
            ['effect', 'Uso em cena']
        ],
        scene: [
            ['mapPath', 'Terreno'],
            ['audioPath', 'Trilha'],
            ['weather', 'Pressagio'],
            ['handoutPath', 'Pergaminho']
        ],
        item: [
            ['weight', 'Peso'],
            ['cost', 'Custo'],
            ['effect', 'Efeito']
        ]
    };

    const TYPE_ORDER = ['weapon', 'armor', 'power', 'talent', 'condition', 'creature', 'npc', 'handout', 'scene', 'item'];
    const DRAG_MIME = 'application/x-cosmere-compendium';

    window.COMPENDIUM_TYPES = window.COMPENDIUM_TYPES || COMPENDIUM_TYPES;
    window.compendiumState = window.compendiumState || {
        entries: [],
        filters: {
            search: '',
            type: 'all',
            tag: 'all',
            sort: 'az'
        },
        editingId: null
    };

    function ensureState() {
        window.compendiumState = {
            entries: [],
            filters: { search: '', type: 'all', tag: 'all', sort: 'az' },
            editingId: null,
            ...(window.compendiumState || {})
        };
        window.compendiumState.filters = {
            search: '',
            type: 'all',
            tag: 'all',
            sort: 'az',
            ...(window.compendiumState.filters || {})
        };
        return window.compendiumState;
    }

    function normalizeLegacyEntry(item) {
        const now = new Date().toISOString();
        return normalizeCompendiumEntry({
            id: item.id,
            name: item.name || item.nome || 'Item sem nome',
            type: item.type || 'item',
            category: item.category || 'Itens gerais',
            image: item.image || item.imagem || '',
            summary: item.summary || item.obs || '',
            description: item.description || item.obs || '',
            tags: item.tags || [],
            rarity: item.rarity || 'comum',
            source: item.source || '',
            mechanics: item.mechanics || {},
            actorTemplate: item.actorTemplate || null,
            createdAt: item.createdAt || now,
            updatedAt: item.updatedAt || now
        });
    }

    function normalizeCompendiumEntry(entry) {
        const now = new Date().toISOString();
        return {
            id: entry.id || `cmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: entry.name || 'Novo registro',
            type: entry.type || 'item',
            category: entry.category || TYPE_LABELS[entry.type || 'item'] || 'Itens gerais',
            image: entry.image || '',
            summary: entry.summary || '',
            description: entry.description || '',
            tags: Array.isArray(entry.tags) ? entry.tags : parseTags(entry.tags),
            rarity: entry.rarity || 'comum',
            source: entry.source || '',
            mechanics: entry.mechanics || {},
            actorTemplate: entry.actorTemplate || null,
            createdAt: entry.createdAt || now,
            updatedAt: now
        };
    }

    async function loadCompendiumEntries() {
        const state = ensureState();
        if (window.api?.getCompendiumEntries) {
            const entries = await window.api.getCompendiumEntries();
            state.entries = Array.isArray(entries) ? entries.map(normalizeCompendiumEntry) : [];
        } else {
            state.entries = [];
        }

        await migrateLegacyLocalCompendium();
        renderCompendium();
    }

    async function migrateLegacyLocalCompendium() {
        if (!window.api?.saveCompendiumEntry) return;

        let legacy = [];
        try {
            legacy = JSON.parse(localStorage.getItem('cosmere_compendio') || '[]');
        } catch (error) {
            legacy = [];
        }

        if (!legacy.length) return;
        for (const item of legacy) {
            await saveCompendiumEntry(normalizeLegacyEntry(item), { silent: true });
        }
        localStorage.removeItem('cosmere_compendio');
    }

    async function saveCompendiumEntry(entry, options = {}) {
        const state = ensureState();
        const normalized = normalizeCompendiumEntry(entry);

        if (window.api?.saveCompendiumEntry) {
            await window.api.saveCompendiumEntry(JSON.stringify(normalized));
        }

        const index = state.entries.findIndex(item => item.id === normalized.id);
        if (index >= 0) state.entries[index] = normalized;
        else state.entries.push(normalized);

        if (!options.silent) renderCompendium();
        return normalized;
    }

    async function deleteCompendiumEntry(id) {
        const state = ensureState();
        if (window.api?.deleteCompendiumEntry) await window.api.deleteCompendiumEntry(id);
        state.entries = state.entries.filter(entry => entry.id !== id);
        renderCompendium();
    }

    function getFilteredCompendiumEntries() {
        const state = ensureState();
        const { search, type, tag, sort } = state.filters;
        let entries = [...state.entries];

        if (search) {
            const term = search.toLowerCase();
            entries = entries.filter(entry => [
                entry.name,
                entry.summary,
                entry.description,
                entry.category,
                ...(entry.tags || [])
            ].join(' ').toLowerCase().includes(term));
        }

        if (type && type !== 'all') entries = entries.filter(entry => entry.type === type);
        if (tag && tag !== 'all') entries = entries.filter(entry => (entry.tags || []).includes(tag));

        if (sort === 'az') entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        if (sort === 'type') entries.sort((a, b) => typeSortValue(a.type) - typeSortValue(b.type) || String(a.name).localeCompare(String(b.name)));
        if (sort === 'recent') entries.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

        return entries;
    }

    function typeSortValue(type) {
        const index = TYPE_ORDER.indexOf(type);
        return index < 0 ? 999 : index;
    }

    function groupCompendiumByType(entries) {
        return entries.reduce((groups, entry) => {
            const type = entry.type || 'item';
            if (!groups[type]) groups[type] = [];
            groups[type].push(entry);
            return groups;
        }, {});
    }

    function renderCompendium() {
        const container = document.getElementById('items-content');
        if (!container) return;

        const entries = getFilteredCompendiumEntries();
        const groups = groupCompendiumByType(entries);
        const orderedGroups = Object.entries(groups).sort(([a], [b]) => typeSortValue(a) - typeSortValue(b));

        container.innerHTML = `
            <div class="compendium-panel">
                ${renderCompendiumToolbar()}
                ${orderedGroups.length ? orderedGroups.map(([type, items]) => renderCompendiumGroup(type, items)).join('') : renderCompendiumEmpty()}
            </div>
        `;

        bindCompendiumPanel(container);
    }

    function renderCompendiumToolbar() {
        const state = ensureState();
        const tags = getAllTags();
        return `
            <div class="compendium-toolbar">
                <div class="compendium-filter-row">
                    <input class="vtt-input" type="text" data-compendium-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Buscar no grimorio...">
                    <select class="vtt-select" data-compendium-filter="type">
                        <option value="all">Todo o grimorio</option>
                        ${TYPE_ORDER.map(type => `<option value="${type}" ${state.filters.type === type ? 'selected' : ''}>${TYPE_LABELS[type]}</option>`).join('')}
                    </select>
                    <select class="vtt-select" data-compendium-filter="tag">
                        <option value="all">Todos os selos</option>
                        ${tags.map(tag => `<option value="${escapeHtml(tag)}" ${state.filters.tag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
                    </select>
                    <select class="vtt-select" data-compendium-filter="sort">
                        <option value="az" ${state.filters.sort === 'az' ? 'selected' : ''}>Ordem alfabetica</option>
                        <option value="type" ${state.filters.sort === 'type' ? 'selected' : ''}>Por tomo</option>
                        <option value="recent" ${state.filters.sort === 'recent' ? 'selected' : ''}>Inscricoes recentes</option>
                    </select>
                </div>
                <div class="compendium-filter-row compendium-filter-row--actions">
                    <button class="ui-btn ui-btn--primary" type="button" data-compendium-action="new"><i class="fas fa-feather"></i> Nova entrada</button>
                    <button class="ui-btn" type="button" data-compendium-action="seed"><i class="fas fa-seedling"></i> Semear exemplos</button>
                    <button class="ui-btn" type="button" data-compendium-action="import-equipment"><i class="fas fa-suitcase"></i> Saquear fichas</button>
                    <button class="ui-btn" type="button" data-compendium-action="import"><i class="fas fa-file-import"></i> Importar tomo</button>
                    <button class="ui-btn" type="button" data-compendium-action="export"><i class="fas fa-scroll"></i> Exportar tomo</button>
                </div>
            </div>
        `;
    }

    function renderCompendiumGroup(type, items) {
        return `
            <section class="compendium-group">
                <header class="compendium-group-header">
                    <strong><i class="fas ${TYPE_ICONS[type] || TYPE_ICONS.item}"></i> ${TYPE_LABELS[type] || type}</strong>
                    <span>${items.length}</span>
                </header>
                <div class="compendium-card-grid">
                    ${items.map(renderCompendiumEntryCard).join('')}
                </div>
            </section>
        `;
    }

    function renderCompendiumEntryCard(entry) {
        const mechanicText = getMechanicSummary(entry);
        return `
            <article class="compendium-entry-card compendium-entry-card--${escapeAttr(entry.type)}" draggable="true" data-compendium-entry-id="${escapeAttr(entry.id)}">
                <div class="compendium-entry-card__drag" title="Arrastar"><i class="fas fa-grip-vertical"></i></div>
                <button class="compendium-entry-card__main" type="button" data-compendium-action="edit" data-compendium-entry-id="${escapeAttr(entry.id)}">
                    <div class="compendium-entry-card__icon"><i class="fas ${TYPE_ICONS[entry.type] || TYPE_ICONS.item}"></i></div>
                    <div class="compendium-entry-card__body">
                        <strong>${escapeHtml(entry.name)}</strong>
                        <span>${escapeHtml(entry.summary || entry.description || 'Sem resumo.')}</span>
                        ${mechanicText ? `<small>${escapeHtml(mechanicText)}</small>` : ''}
                        <div class="compendium-entry-badges">
                            <em>${escapeHtml(TYPE_LABELS[entry.type] || entry.type)}</em>
                            ${(entry.tags || []).slice(0, 3).map(tag => `<em>${escapeHtml(tag)}</em>`).join('')}
                        </div>
                    </div>
                </button>
                <div class="compendium-entry-card__actions">
                    <button class="ui-icon-btn" type="button" data-compendium-action="edit" data-compendium-entry-id="${escapeAttr(entry.id)}" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="ui-icon-btn" type="button" data-compendium-action="duplicate" data-compendium-entry-id="${escapeAttr(entry.id)}" title="Duplicar"><i class="fas fa-copy"></i></button>
                    <button class="ui-icon-btn ui-icon-btn--danger" type="button" data-compendium-action="delete" data-compendium-entry-id="${escapeAttr(entry.id)}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </article>
        `;
    }

    function renderCompendiumEmpty() {
        return `
            <div class="vtt-empty-state vtt-empty-state--library">
                <i class="fas fa-book-open"></i>
                <span>Nenhuma entrada encontrada no grimorio.</span>
            </div>
        `;
    }

    function bindCompendiumPanel(container) {
        container.querySelectorAll('[data-compendium-filter]').forEach(control => {
            control.addEventListener('input', updateCompendiumFilter);
            control.addEventListener('change', updateCompendiumFilter);
        });

        container.querySelectorAll('[data-compendium-action]').forEach(button => {
            button.addEventListener('click', handleCompendiumAction);
        });

        container.querySelectorAll('[draggable="true"][data-compendium-entry-id]').forEach(card => {
            card.addEventListener('dragstart', event => dragCompendiumEntry(event, card.dataset.compendiumEntryId));
        });
    }

    function updateCompendiumFilter(event) {
        const key = event.currentTarget.dataset.compendiumFilter;
        ensureState().filters[key] = event.currentTarget.value;
        renderCompendium();
    }

    function filtrarCompendio(term) {
        ensureState().filters.search = term || '';
        renderCompendium();
    }

    async function handleCompendiumAction(event) {
        const action = event.currentTarget.dataset.compendiumAction;
        const entryId = event.currentTarget.dataset.compendiumEntryId;
        if (action === 'new') return abrirModalItem();
        if (action === 'edit') return abrirModalItem(entryId);
        if (action === 'duplicate') return duplicateCompendiumEntry(entryId);
        if (action === 'delete') return deleteCompendiumEntry(entryId);
        if (action === 'import') return importCompendium();
        if (action === 'import-equipment') return importCharacterEquipmentCompendium();
        if (action === 'export') return exportCompendium();
        if (action === 'seed') return seedStarterCompendium();
    }

    function abrirModalItem(entryId = null) {
        const state = ensureState();
        state.editingId = typeof entryId === 'string' ? entryId : null;
        const entry = state.entries.find(item => item.id === state.editingId) || normalizeCompendiumEntry({ type: 'item' });
        renderCompendiumEditor(entry);
        document.getElementById('item-compendium-modal')?.classList.remove('hidden');
    }

    function fecharModalItem() {
        document.getElementById('item-compendium-modal')?.classList.add('hidden');
    }

    function renderCompendiumEditor(entry) {
        const modal = document.getElementById('item-compendium-modal');
        if (!modal) return;
        const fields = MECHANIC_FIELDS[entry.type] || MECHANIC_FIELDS.item;

        modal.innerHTML = `
            <div class="vtt-modal vtt-modal--item compendium-editor">
                <div class="vtt-modal-header">
                    <h3 class="vtt-modal-title">${entry.id ? 'Entrada do grimorio' : 'Nova entrada'}</h3>
                    <button class="ui-icon-btn" type="button" data-compendium-editor-action="close" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
                <div class="vtt-modal-body compendium-editor__body">
                    <label class="vtt-field">
                        <span>Nome</span>
                        <input class="vtt-input" id="compendium-entry-name" type="text" value="${escapeHtml(entry.name)}">
                    </label>
                    <label class="vtt-field">
                        <span>Tipo</span>
                        <select class="vtt-select" id="compendium-entry-type">
                            ${TYPE_ORDER.map(type => `<option value="${type}" ${entry.type === type ? 'selected' : ''}>${TYPE_LABELS[type]}</option>`).join('')}
                        </select>
                    </label>
                    <label class="vtt-field">
                        <span>Categoria</span>
                        <input class="vtt-input" id="compendium-entry-category" type="text" value="${escapeHtml(entry.category)}">
                    </label>
                    <label class="vtt-field">
                        <span>Arte / arquivo</span>
                        <input class="vtt-input" id="compendium-entry-image" type="text" value="${escapeHtml(entry.image)}" placeholder="lanca.png ou caminho completo">
                    </label>
                    <label class="vtt-field">
                        <span>Resumo de mesa</span>
                        <input class="vtt-input" id="compendium-entry-summary" type="text" value="${escapeHtml(entry.summary)}">
                    </label>
                    <label class="vtt-field compendium-editor__wide">
                        <span>Lore e regras</span>
                        <textarea class="vtt-textarea" id="compendium-entry-description">${escapeHtml(entry.description)}</textarea>
                    </label>
                    <label class="vtt-field">
                        <span>Selos</span>
                        <input class="vtt-input" id="compendium-entry-tags" type="text" value="${escapeHtml((entry.tags || []).join(', '))}">
                    </label>
                    <label class="vtt-field">
                        <span>Raridade</span>
                        <input class="vtt-input" id="compendium-entry-rarity" type="text" value="${escapeHtml(entry.rarity)}">
                    </label>
                    <label class="vtt-field">
                        <span>Fonte</span>
                        <input class="vtt-input" id="compendium-entry-source" type="text" value="${escapeHtml(entry.source)}">
                    </label>
                    <section class="compendium-editor__wide">
                        <div class="compendium-group-header"><strong>Regras de mesa</strong><span>${TYPE_LABELS[entry.type] || entry.type}</span></div>
                        <div class="compendium-mechanics-grid">
                            ${fields.map(([key, label]) => `
                                <label class="vtt-field">
                                    <span>${escapeHtml(label)}</span>
                                    <input class="vtt-input" data-mechanic-key="${escapeAttr(key)}" type="text" value="${escapeHtml(entry.mechanics?.[key] ?? entry.actorTemplate?.[key] ?? '')}">
                                </label>
                            `).join('')}
                        </div>
                    </section>
                </div>
                <div class="vtt-modal-footer">
                    <button class="ui-btn" type="button" data-compendium-editor-action="close">Cancelar</button>
                    <button class="ui-btn ui-btn--primary" type="button" data-compendium-editor-action="save"><i class="fas fa-book-bookmark"></i> Registrar</button>
                </div>
            </div>
        `;

        modal.querySelector('#compendium-entry-type')?.addEventListener('change', () => {
            const draft = readEditorEntry();
            draft.type = modal.querySelector('#compendium-entry-type').value;
            draft.category = draft.category || TYPE_LABELS[draft.type] || '';
            renderCompendiumEditor(draft);
        });

        modal.querySelectorAll('[data-compendium-editor-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.compendiumEditorAction;
                if (action === 'close') fecharModalItem();
                if (action === 'save') await salvarItemCompendio();
            });
        });
    }

    function readEditorEntry() {
        const state = ensureState();
        const existing = state.entries.find(item => item.id === state.editingId) || {};
        const type = document.getElementById('compendium-entry-type')?.value || existing.type || 'item';
        const mechanics = {};
        document.querySelectorAll('#item-compendium-modal [data-mechanic-key]').forEach(input => {
            mechanics[input.dataset.mechanicKey] = input.value.trim();
        });

        const actorTemplate = ['creature', 'npc'].includes(type) ? {
            hpAtual: parseInt(mechanics.hpAtual, 10) || 10,
            hpMax: parseInt(mechanics.hpMax, 10) || 10,
            type: type === 'npc' ? 'NPC' : 'Monster',
            tokenPath: mechanics.tokenPath || '',
            ataques: mechanics.attacks || '',
            attributes: mechanics.attributes || '',
            conditions: []
        } : null;

        return normalizeCompendiumEntry({
            ...existing,
            name: document.getElementById('compendium-entry-name')?.value.trim() || 'Novo registro',
            type,
            category: document.getElementById('compendium-entry-category')?.value.trim() || TYPE_LABELS[type] || '',
            image: document.getElementById('compendium-entry-image')?.value.trim() || '',
            summary: document.getElementById('compendium-entry-summary')?.value.trim() || '',
            description: document.getElementById('compendium-entry-description')?.value || '',
            tags: parseTags(document.getElementById('compendium-entry-tags')?.value || ''),
            rarity: document.getElementById('compendium-entry-rarity')?.value.trim() || 'comum',
            source: document.getElementById('compendium-entry-source')?.value.trim() || '',
            mechanics,
            actorTemplate
        });
    }

    async function salvarItemCompendio() {
        await saveCompendiumEntry(readEditorEntry());
        fecharModalItem();
    }

    async function duplicateCompendiumEntry(entryId) {
        const entry = ensureState().entries.find(item => item.id === entryId);
        if (!entry) return;
        await saveCompendiumEntry({
            ...entry,
            id: null,
            name: `${entry.name} (copia)`,
            createdAt: null
        });
    }

    function dragCompendiumEntry(event, entryId) {
        const entry = ensureState().entries.find(item => item.id === entryId);
        if (!entry) return;
        const payload = JSON.stringify({ source: 'compendium', entryId: entry.id, type: entry.type });
        event.dataTransfer.setData(DRAG_MIME, payload);
        event.dataTransfer.setData('text/plain', payload);
        event.dataTransfer.effectAllowed = 'copy';
    }

    function getDraggedCompendiumEntry(event) {
        try {
            const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain');
            const payload = JSON.parse(raw);
            if (!payload?.entryId) return null;
            return ensureState().entries.find(entry => entry.id === payload.entryId) || null;
        } catch (error) {
            return null;
        }
    }

    function setupCompendiumDrops() {
        document.addEventListener('dragover', event => {
            const entry = getDraggedCompendiumEntry(event);
            if (!entry) return;
            if (getDropZoneForEvent(event, entry)) event.preventDefault();
        });

        document.addEventListener('drop', event => {
            const entry = getDraggedCompendiumEntry(event);
            if (!entry) return;
            const zone = getDropZoneForEvent(event, entry);
            if (!zone) return;
            event.preventDefault();
            handleCompendiumDrop(entry, zone, event);
        });
    }

    function getDropZoneForEvent(event, entry) {
        if (event.target.closest('#equipment-container') && ['item', 'weapon', 'armor'].includes(entry.type)) return 'equipment';
        if (event.target.closest('#talents-container, #tab-magic') && ['power', 'talent'].includes(entry.type)) return 'powers';
        if (event.target.closest('#director-content') && ['handout', 'scene'].includes(entry.type)) return 'scene';
        if (event.target.closest('#game-container, canvas') && ['creature', 'npc', 'condition'].includes(entry.type)) return 'map';
        return null;
    }

    function handleCompendiumDrop(entry, zone, event) {
        const characterId = window.getCurrentCharacterId?.();
        if (zone === 'equipment') return window.addCompendiumEntryToEquipment?.(characterId, entry);
        if (zone === 'powers') return window.addCompendiumEntryToPowers?.(characterId, entry);
        if (zone === 'scene') return applyCompendiumEntryToScene(entry);
        if (zone === 'map') {
            const point = getWorldPointFromDrop(event);
            const token = findTokenAtWorldPoint(point.x, point.y) || window.selectedToken;
            if (entry.type === 'condition') return applyCompendiumConditionToToken(entry, token);
            return spawnCreatureFromCompendium(entry, point.x, point.y);
        }
    }

    function getWorldPointFromDrop(event) {
        const scene = window.phaserScene;
        if (!scene?.cameras?.main) return { x: event.clientX, y: event.clientY };
        const rect = scene.game.canvas.getBoundingClientRect();
        const camera = scene.cameras.main;
        return {
            x: camera.scrollX + ((event.clientX - rect.left) / camera.zoom),
            y: camera.scrollY + ((event.clientY - rect.top) / camera.zoom)
        };
    }

    function findTokenAtWorldPoint(x, y) {
        return window.phaserScene?.camadaTokens?.list?.find(token => {
            const width = token.displayWidth || 0;
            const height = token.displayHeight || 0;
            return x >= token.x - width / 2 && x <= token.x + width / 2 && y >= token.y - height / 2 && y <= token.y + height / 2;
        }) || null;
    }

    function spawnCreatureFromCompendium(entry, x, y) {
        if (!window.phaserScene || !window.fichasSalvas) return;
        const characterId = `actor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const libraryToken = window.assetsLibraryState?.assets?.find(asset => asset.type === 'token' && !asset.missing);
        const tokenPath = entry.actorTemplate?.tokenPath || entry.mechanics?.tokenPath || entry.image || libraryToken?.path || '';
        if (!tokenPath) {
            window.mostrarToast?.('Vincule uma arte de token antes de colocar esta criatura no mapa.', 'warning');
            return;
        }
        const ficha = {
            id: characterId,
            nome: entry.name,
            type: entry.type === 'npc' ? 'NPC' : 'Monster',
            hpAtual: parseInt(entry.actorTemplate?.hpAtual ?? entry.mechanics?.hpAtual, 10) || 10,
            hpMax: parseInt(entry.actorTemplate?.hpMax ?? entry.mechanics?.hpMax, 10) || 10,
            portraitPath: entry.actorTemplate?.portraitPath || tokenPath,
            tokenPath,
            equipamentos: entry.actorTemplate?.equipamentos || [],
            poderes: entry.actorTemplate?.poderes || [],
            conditions: [],
            compendiumId: entry.id
        };

        window.fichasSalvas[characterId] = ficha;
        if (window.api?.saveCharacter) window.api.saveCharacter(characterId, JSON.stringify(ficha));

        const safeName = entry.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        window.phaserScene.spawnTokenAt(`tk_${safeName}_${Date.now()}`, tokenPath, x, y, '', characterId, false, entry.name, {
            hp: ficha.hpAtual,
            hpMax: ficha.hpMax,
            conditions: []
        });
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
    }

    function applyCompendiumConditionToToken(entry, token) {
        if (!entry || entry.type !== 'condition' || !token) return;
        if (typeof window.addCondition === 'function') window.addCondition(token.tokenId, entry.name);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('condition_added', 'Condicao aplicada', `${entry.name} em ${token.charName || token.tokenId}`, {
                conditionId: entry.id,
                tokenId: token.tokenId
            });
        }
    }

    function applyCompendiumEntryToScene(entry) {
        if (entry.type === 'handout') {
            const path = entry.mechanics?.path || entry.image;
            const handout = document.getElementById('director-handout');
            if (handout && path) {
                if (![...handout.options].some(option => option.value === path)) {
                    handout.insertAdjacentHTML('beforeend', `<option value="${escapeAttr(path)}">${escapeHtml(entry.name)}</option>`);
                }
                handout.value = path;
            }
        }

        if (entry.type === 'scene' && typeof window.restoreDirectedSceneFromState === 'function') {
            window.restoreDirectedSceneFromState({
                sceneName: entry.name,
                introText: entry.description,
                mapPath: entry.mechanics?.mapPath || '',
                audioPath: entry.mechanics?.audioPath || '',
                weather: entry.mechanics?.weather || 'none',
                handoutPath: entry.mechanics?.handoutPath || ''
            });
        }

        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('scene_prepared', 'Registro aplicado a cena', entry.name, { compendiumId: entry.id, type: entry.type });
        }
    }

    function exportCompendium() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            entries: ensureState().entries
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cosmere_compendium_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importCompendium() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async event => {
            const file = event.target.files[0];
            if (!file) return;
            const data = JSON.parse(await file.text());
            const entries = Array.isArray(data.entries) ? data.entries : [];
            for (const entry of entries) {
                await saveCompendiumEntry({ ...entry, id: entry.id || null }, { silent: true });
            }
            renderCompendium();
        };
        input.click();
    }

    async function importCharacterEquipmentCompendium() {
        if (!window.api?.importCharacterEquipmentCompendium) return;
        let result;
        try {
            result = await window.api.importCharacterEquipmentCompendium();
            const entries = await window.api.getCompendiumEntries();
            ensureState().entries = Array.isArray(entries) ? entries.map(normalizeCompendiumEntry) : [];
            renderCompendium();
        } catch (error) {
            console.error('Erro ao importar equipamentos das fichas para o compendio:', error);
            if (typeof window.mostrarToast === 'function') {
                window.mostrarToast('Nao foi possivel importar equipamentos das fichas.', 'danger', 'fa-triangle-exclamation');
            }
            return;
        }

        if (typeof window.mostrarToast === 'function') {
            const count = result?.importedCount || 0;
            const message = count
                ? `${count} equipamento(s) importado(s) das fichas.`
                : 'Nenhum equipamento novo para importar.';
            window.mostrarToast(message, count ? 'success' : 'info', 'fa-book');
        }
    }

    async function seedStarterCompendium() {
        const starterEntries = [
            {
                type: 'weapon',
                name: 'Lanca',
                category: 'Armas',
                summary: 'Arma longa de combate corpo a corpo.',
                tags: ['corpo a corpo', 'haste'],
                mechanics: { damage: '1d8', attribute: 'FORCA', skill: 'Armamento Pesado', range: '1,5m' }
            },
            {
                type: 'condition',
                name: 'Caido',
                category: 'Condicoes',
                summary: 'O alvo esta no chao.',
                mechanics: { effect: 'Pode sofrer desvantagem em certas acoes fisicas.' }
            },
            {
                type: 'power',
                name: 'Gravitacao Basica',
                category: 'Surges',
                summary: 'Manipula direcao e forca da gravidade.',
                tags: ['surge', 'gravitacao'],
                mechanics: { cost: '1 investidura', range: 'curto', duration: '1 rodada', effect: 'Altera a direcao da queda de um alvo ou objeto.' }
            }
        ];

        for (const entry of starterEntries) {
            if (!ensureState().entries.some(item => item.name === entry.name && item.type === entry.type)) {
                await saveCompendiumEntry(entry, { silent: true });
            }
        }
        renderCompendium();
    }

    function getAllTags() {
        return [...new Set(ensureState().entries.flatMap(entry => entry.tags || []))].sort((a, b) => a.localeCompare(b));
    }

    function getMechanicSummary(entry) {
        const m = entry.mechanics || {};
        if (entry.type === 'weapon') return [m.damage, m.range, m.attribute].filter(Boolean).join(' | ');
        if (entry.type === 'armor') return [`Def ${m.defense || 0}`, m.penalty ? `Pen ${m.penalty}` : ''].filter(Boolean).join(' | ');
        if (entry.type === 'power') return [m.cost, m.range, m.duration].filter(Boolean).join(' | ');
        if (entry.type === 'condition') return m.effect || '';
        if (['creature', 'npc'].includes(entry.type)) return `HP ${m.hpAtual || entry.actorTemplate?.hpAtual || 10}/${m.hpMax || entry.actorTemplate?.hpMax || 10}`;
        return m.effect || m.cost || '';
    }

    function parseTags(value) {
        if (Array.isArray(value)) return value.map(String).map(tag => tag.trim()).filter(Boolean);
        return String(value || '').split(',').map(tag => tag.trim()).filter(Boolean);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    window.loadCompendiumEntries = loadCompendiumEntries;
    window.saveCompendiumEntry = saveCompendiumEntry;
    window.deleteCompendiumEntry = deleteCompendiumEntry;
    window.renderCompendium = renderCompendium;
    window.renderizarCompendio = renderCompendium;
    window.filtrarCompendio = filtrarCompendio;
    window.abrirModalItem = abrirModalItem;
    window.fecharModalItem = fecharModalItem;
    window.salvarItemCompendio = salvarItemCompendio;
    window.dragCompendiumEntry = dragCompendiumEntry;
    window.getDraggedCompendiumEntry = getDraggedCompendiumEntry;
    window.exportCompendium = exportCompendium;
    window.importCompendium = importCompendium;
    window.importCharacterEquipmentCompendium = importCharacterEquipmentCompendium;
    window.seedStarterCompendium = seedStarterCompendium;
    window.spawnCreatureFromCompendium = spawnCreatureFromCompendium;
    window.applyCompendiumConditionToToken = applyCompendiumConditionToToken;

    document.addEventListener('DOMContentLoaded', () => {
        setupCompendiumDrops();
        loadCompendiumEntries();
    });
})();
