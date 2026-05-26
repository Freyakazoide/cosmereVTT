(function initAssetsLibrary() {
    const ASSET_TYPES = {
        MAP: 'map',
        TOKEN: 'token',
        PORTRAIT: 'portrait',
        IMAGE: 'image',
        VIDEO: 'video',
        AUDIO: 'audio',
        HANDOUT: 'handout'
    };

    const TYPE_LABELS = {
        map: 'Mapa',
        token: 'Token',
        portrait: 'Retrato',
        image: 'Imagem',
        video: 'Video',
        audio: 'Audio',
        handout: 'Handout'
    };

    const TYPE_ICONS = {
        map: 'fa-map',
        token: 'fa-user-ninja',
        portrait: 'fa-id-card',
        image: 'fa-image',
        video: 'fa-film',
        audio: 'fa-music',
        handout: 'fa-scroll'
    };

    const ASSET_DRAG_MIME = 'application/x-cosmere-asset';

    window.ASSET_TYPES = window.ASSET_TYPES || ASSET_TYPES;
    window.assetsLibraryState = window.assetsLibraryState || {
        assets: [],
        filters: {
            search: '',
            type: 'all',
            category: 'all',
            tag: 'all',
            favoritesOnly: false,
            missingOnly: false,
            sort: 'az'
        },
        selectedAssetId: null
    };

    function ensureAssetsState() {
        window.assetsLibraryState = {
            assets: [],
            filters: {
                search: '',
                type: 'all',
                category: 'all',
                tag: 'all',
                favoritesOnly: false,
                missingOnly: false,
                sort: 'az'
            },
            selectedAssetId: null,
            ...(window.assetsLibraryState || {})
        };
        window.assetsLibraryState.filters = {
            search: '',
            type: 'all',
            category: 'all',
            tag: 'all',
            favoritesOnly: false,
            missingOnly: false,
            sort: 'az',
            ...(window.assetsLibraryState.filters || {})
        };
        return window.assetsLibraryState;
    }

    async function loadAssetsLibrary() {
        const state = ensureAssetsState();
        state.assets = window.api?.getAssetsLibrary ? await window.api.getAssetsLibrary() : [];
        renderAssetsLibrary();
    }

    function getFilteredAssets() {
        const state = ensureAssetsState();
        const { search, type, category, tag, favoritesOnly, missingOnly, sort } = state.filters;
        let assets = [...state.assets];

        if (search) {
            const term = search.toLowerCase();
            assets = assets.filter(asset => [
                asset.name,
                asset.fileName,
                asset.category,
                asset.type,
                ...(asset.tags || [])
            ].join(' ').toLowerCase().includes(term));
        }

        if (type !== 'all') assets = assets.filter(asset => asset.type === type);
        if (category !== 'all') assets = assets.filter(asset => (asset.category || '') === category);
        if (tag !== 'all') assets = assets.filter(asset => (asset.tags || []).includes(tag));
        if (favoritesOnly) assets = assets.filter(asset => asset.favorite);
        if (missingOnly) assets = assets.filter(asset => asset.missing);

        if (sort === 'az') assets.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        if (sort === 'type') assets.sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name)));
        if (sort === 'recent') assets.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        if (sort === 'size') assets.sort((a, b) => Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0));

        return assets;
    }

    function renderAssetsLibrary() {
        const grid = document.getElementById('assets-library-grid');
        const count = document.getElementById('assets-library-count');
        if (!grid) return;

        const state = ensureAssetsState();
        const assets = getFilteredAssets();
        if (count) count.textContent = `${assets.length} asset${assets.length === 1 ? '' : 's'}`;
        syncAssetFilterControls();

        if (!assets.length) {
            grid.innerHTML = `
                <div class="vtt-empty-state vtt-empty-state--library">
                    <i class="fas fa-box-archive"></i>
                    <span>Nenhum asset encontrado.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = assets.map(renderAssetCard).join('');
        grid.querySelectorAll('[draggable="true"][data-asset-id]').forEach(card => {
            card.addEventListener('dragstart', event => dragAsset(event, card.dataset.assetId));
        });
    }

    function renderAssetCard(asset) {
        return `
            <article class="asset-card asset-card--${escapeAssetAttr(asset.type)} ${asset.missing ? 'is-missing' : ''}" draggable="true" data-asset-id="${escapeAssetAttr(asset.id)}">
                <button class="asset-card__preview" type="button" onclick="previewAsset('${escapeAssetAttr(asset.id)}')">
                    ${renderAssetPreview(asset)}
                </button>
                <div class="asset-card__body">
                    <strong>${escapeAssetHtml(asset.name)}</strong>
                    <span>${escapeAssetHtml(TYPE_LABELS[asset.type] || asset.type)} · ${escapeAssetHtml(asset.category || 'Sem categoria')}</span>
                    <small>${asset.missing ? 'Arquivo ausente' : formatAssetSize(asset.sizeBytes)}</small>
                    <div class="asset-card__tags">
                        <em class="asset-type-pill">${escapeAssetHtml(asset.type)}</em>
                        ${(asset.tags || []).slice(0, 3).map(tag => `<em class="asset-tag">${escapeAssetHtml(tag)}</em>`).join('')}
                    </div>
                </div>
                <div class="asset-card__actions">
                    <button class="ui-icon-btn ${asset.favorite ? 'is-active' : ''}" type="button" onclick="toggleAssetFavorite('${escapeAssetAttr(asset.id)}')" title="Favorito"><i class="fas fa-star"></i></button>
                    <button class="ui-icon-btn" type="button" onclick="openAssetEditor('${escapeAssetAttr(asset.id)}')" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="ui-icon-btn ui-icon-btn--danger" type="button" onclick="deleteAsset('${escapeAssetAttr(asset.id)}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </article>
        `;
    }

    function renderAssetPreview(asset) {
        if (asset.missing) {
            return '<div class="asset-preview asset-preview--missing"><i class="fas fa-triangle-exclamation"></i></div>';
        }
        if (['map', 'token', 'portrait', 'image', 'handout'].includes(asset.type)) {
            return `<img src="file://${escapeAssetAttr(asset.path)}" alt="">`;
        }
        if (asset.type === 'video') {
            return `<video src="file://${escapeAssetAttr(asset.path)}" muted preload="metadata"></video>`;
        }
        if (asset.type === 'audio') {
            return '<div class="asset-preview asset-preview--audio"><i class="fas fa-music"></i></div>';
        }
        return '<div class="asset-preview"><i class="fas fa-file"></i></div>';
    }

    function syncAssetFilterControls() {
        const state = ensureAssetsState();
        setControlValue('assets-search', state.filters.search);
        setControlValue('assets-type-filter', state.filters.type);
        setControlValue('assets-category-filter', state.filters.category);
        setControlValue('assets-tag-filter', state.filters.tag);
        setControlValue('assets-sort-filter', state.filters.sort);
        document.getElementById('assets-favorites-filter')?.classList.toggle('is-active', state.filters.favoritesOnly);
        document.getElementById('assets-missing-filter')?.classList.toggle('is-active', state.filters.missingOnly);
    }

    function setControlValue(id, value) {
        const control = document.getElementById(id);
        if (control && control.value !== value) control.value = value;
    }

    function setAssetsSearch(value) {
        ensureAssetsState().filters.search = value || '';
        renderAssetsLibrary();
    }

    function setAssetsTypeFilter(value) {
        ensureAssetsState().filters.type = value || 'all';
        renderAssetsLibrary();
    }

    function setAssetsCategoryFilter(value) {
        ensureAssetsState().filters.category = value || 'all';
        renderAssetsLibrary();
    }

    function setAssetsTagFilter(value) {
        ensureAssetsState().filters.tag = value || 'all';
        renderAssetsLibrary();
    }

    function setAssetsSort(value) {
        ensureAssetsState().filters.sort = value || 'az';
        renderAssetsLibrary();
    }

    function toggleAssetsFavoritesOnly() {
        const filters = ensureAssetsState().filters;
        filters.favoritesOnly = !filters.favoritesOnly;
        renderAssetsLibrary();
    }

    function toggleAssetsMissingOnly() {
        const filters = ensureAssetsState().filters;
        filters.missingOnly = !filters.missingOnly;
        renderAssetsLibrary();
    }

    async function importAssetFromDialog(type = null) {
        if (!window.api?.importAsset) return;
        const imported = await window.api.importAsset(JSON.stringify({ type }));
        if (Array.isArray(imported) && imported.length) {
            ensureAssetsState().assets = await window.api.getAssetsLibrary();
            renderAssetsLibrary();
        }
    }

    async function scanAssetsFolders() {
        if (!window.api?.scanAssetsFolders) return;
        ensureAssetsState().assets = await window.api.scanAssetsFolders();
        renderAssetsLibrary();
    }

    async function validateAssetsLibrary() {
        if (!window.api?.validateAssetsLibrary) return;
        ensureAssetsState().assets = await window.api.validateAssetsLibrary();
        renderAssetsLibrary();
    }

    async function toggleAssetFavorite(assetId) {
        const asset = getAssetById(assetId);
        if (!asset || !window.api?.saveAssetMetadata) return;
        const saved = await window.api.saveAssetMetadata(JSON.stringify({ ...asset, favorite: !asset.favorite }));
        replaceAsset(saved);
        renderAssetsLibrary();
    }

    function openAssetEditor(assetId) {
        const asset = getAssetById(assetId);
        if (!asset) return;
        ensureAssetsState().selectedAssetId = assetId;

        const modal = document.getElementById('asset-editor-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        document.getElementById('asset-editor-preview').innerHTML = renderAssetPreview(asset);
        document.getElementById('asset-editor-name').value = asset.name || '';
        document.getElementById('asset-editor-type').value = asset.type || 'image';
        document.getElementById('asset-editor-category').value = asset.category || '';
        document.getElementById('asset-editor-tags').value = (asset.tags || []).join(', ');
        document.getElementById('asset-editor-favorite').checked = !!asset.favorite;
    }

    function closeAssetEditor() {
        document.getElementById('asset-editor-modal')?.classList.add('hidden');
    }

    async function saveAssetMetadataFromEditor() {
        const state = ensureAssetsState();
        const asset = getAssetById(state.selectedAssetId);
        if (!asset || !window.api?.saveAssetMetadata) return;

        const nextName = document.getElementById('asset-editor-name')?.value.trim() || asset.name;
        let saved;
        if (nextName !== asset.name && window.api.renameAsset) {
            saved = await window.api.renameAsset(JSON.stringify({ assetId: asset.id, newName: nextName }));
        }

        const base = saved || { ...asset, name: nextName };
        saved = await window.api.saveAssetMetadata(JSON.stringify({
            ...base,
            type: document.getElementById('asset-editor-type')?.value || base.type,
            category: document.getElementById('asset-editor-category')?.value.trim() || '',
            tags: parseAssetTags(document.getElementById('asset-editor-tags')?.value || ''),
            favorite: !!document.getElementById('asset-editor-favorite')?.checked
        }));

        replaceAsset(saved);
        closeAssetEditor();
        renderAssetsLibrary();
    }

    async function deleteAsset(assetId) {
        if (!assetId || !window.api?.deleteAsset) return;
        await window.api.deleteAsset(assetId);
        ensureAssetsState().assets = ensureAssetsState().assets.filter(asset => asset.id !== assetId);
        renderAssetsLibrary();
    }

    function previewAsset(assetId) {
        const asset = getAssetById(assetId);
        if (!asset || asset.missing) return;
        if (asset.type === 'audio') {
            new Audio(`file://${asset.path}`).play();
            return;
        }
        openAssetEditor(assetId);
    }

    function dragAsset(event, assetId) {
        const asset = getAssetById(assetId);
        if (!asset) return;
        const payload = JSON.stringify({
            source: 'assets-library',
            assetId: asset.id,
            type: asset.type,
            path: asset.path
        });
        event.dataTransfer.setData(ASSET_DRAG_MIME, payload);
        event.dataTransfer.setData('text/plain', payload);
        event.dataTransfer.effectAllowed = 'copy';
    }

    function getDraggedAssetPayload(event) {
        try {
            const raw = event.dataTransfer.getData(ASSET_DRAG_MIME) || event.dataTransfer.getData('text/plain');
            const payload = JSON.parse(raw);
            return payload?.source === 'assets-library' ? payload : null;
        } catch (error) {
            return null;
        }
    }

    function setupAssetDrops() {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer && gameContainer.dataset.assetDropReady !== 'true') {
            gameContainer.addEventListener('dragover', event => {
                if (getDraggedAssetPayload(event)) event.preventDefault();
            });
            gameContainer.addEventListener('drop', event => {
                const payload = getDraggedAssetPayload(event);
                if (!payload || !window.phaserScene) return;
                event.preventDefault();
                const rect = gameContainer.getBoundingClientRect();
                const pointerX = event.clientX - rect.left;
                const pointerY = event.clientY - rect.top;
                const camera = window.phaserScene.cameras.main;
                const world = camera.getWorldPoint ? camera.getWorldPoint(pointerX, pointerY) : {
                    x: camera.scrollX + pointerX / camera.zoom,
                    y: camera.scrollY + pointerY / camera.zoom
                };
                window.phaserScene.handleAssetDropOnCanvas?.(payload, world.x, world.y);
            });
            gameContainer.dataset.assetDropReady = 'true';
        }

        document.addEventListener('dragover', event => {
            const payload = getDraggedAssetPayload(event);
            if (!payload) return;
            if (event.target.closest('#director-content, #char-sheet-modal, #playlists-content')) event.preventDefault();
        });

        document.addEventListener('drop', event => {
            const payload = getDraggedAssetPayload(event);
            if (!payload) return;
            const asset = getAssetById(payload.assetId);
            if (!asset) return;

            if (event.target.closest('#director-content') && ['image', 'video', 'handout'].includes(asset.type)) {
                event.preventDefault();
                applyAssetToDirector(asset);
            }
            if (event.target.closest('#char-sheet-modal') && asset.type === 'portrait') {
                event.preventDefault();
                applyAssetAsPortrait(asset);
            }
            if (event.target.closest('#playlists-content') && asset.type === 'audio') {
                event.preventDefault();
                if (typeof playMusic === 'function') playMusic(asset.path, asset.name);
            }
        });
    }

    function applyAssetToDirector(asset) {
        const handout = document.getElementById('director-handout');
        if (!handout) return;
        if (![...handout.options].some(option => option.value === asset.path)) {
            handout.insertAdjacentHTML('beforeend', `<option value="${escapeAssetAttr(asset.path)}">${escapeAssetHtml(asset.name)}</option>`);
        }
        handout.value = asset.path;
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('handout_revealed', 'Asset vinculado ao Diretor', asset.name, { assetId: asset.id });
        }
    }

    function applyAssetAsPortrait(asset) {
        const portrait = document.getElementById('char-portrait');
        const characterId = window.getCurrentCharacterId?.();
        const ficha = characterId ? window.fichasSalvas?.[characterId] : null;
        if (portrait) portrait.src = `file://${asset.path}`;
        if (ficha) {
            ficha.portraitPath = asset.path;
            if (window.api?.saveCharacter) window.api.saveCharacter(characterId, JSON.stringify(ficha));
        }
    }

    async function exportAssetsManifest() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            assets: ensureAssetsState().assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                type: asset.type,
                category: asset.category,
                tags: asset.tags,
                fileName: asset.fileName,
                relativePath: asset.relativePath
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign_assets_manifest_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getAssetById(assetId) {
        return ensureAssetsState().assets.find(asset => asset.id === assetId) || null;
    }

    function replaceAsset(asset) {
        if (!asset) return;
        const state = ensureAssetsState();
        const index = state.assets.findIndex(item => item.id === asset.id);
        if (index >= 0) state.assets[index] = asset;
        else state.assets.push(asset);
    }

    function getUniqueValues(key) {
        return [...new Set(ensureAssetsState().assets.map(asset => asset[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    }

    function getUniqueTags() {
        return [...new Set(ensureAssetsState().assets.flatMap(asset => asset.tags || []))].sort((a, b) => String(a).localeCompare(String(b)));
    }

    function populateDynamicFilters() {
        const category = document.getElementById('assets-category-filter');
        const tag = document.getElementById('assets-tag-filter');
        if (category) {
            const current = category.value;
            category.innerHTML = '<option value="all">Todas as categorias</option>' + getUniqueValues('category').map(value => `<option value="${escapeAssetAttr(value)}">${escapeAssetHtml(value)}</option>`).join('');
            category.value = current || 'all';
        }
        if (tag) {
            const current = tag.value;
            tag.innerHTML = '<option value="all">Todas as tags</option>' + getUniqueTags().map(value => `<option value="${escapeAssetAttr(value)}">${escapeAssetHtml(value)}</option>`).join('');
            tag.value = current || 'all';
        }
    }

    function parseAssetTags(value) {
        return String(value || '').split(',').map(tag => tag.trim()).filter(Boolean);
    }

    function formatAssetSize(bytes) {
        const value = Number(bytes || 0);
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    function escapeAssetHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function escapeAssetAttr(value) {
        return escapeAssetHtml(value).replace(/`/g, '&#96;');
    }

    window.loadAssetsLibrary = loadAssetsLibrary;
    window.renderAssetsLibrary = renderAssetsLibrary;
    window.getFilteredAssets = getFilteredAssets;
    window.openAssetEditor = openAssetEditor;
    window.closeAssetEditor = closeAssetEditor;
    window.saveAssetMetadataFromEditor = saveAssetMetadataFromEditor;
    window.deleteSelectedAsset = () => deleteAsset(ensureAssetsState().selectedAssetId);
    window.deleteAsset = deleteAsset;
    window.toggleAssetFavorite = toggleAssetFavorite;
    window.importAssetFromDialog = importAssetFromDialog;
    window.scanAssetsFolders = scanAssetsFolders;
    window.validateAssetsLibrary = validateAssetsLibrary;
    window.setAssetsSearch = setAssetsSearch;
    window.setAssetsTypeFilter = setAssetsTypeFilter;
    window.setAssetsCategoryFilter = setAssetsCategoryFilter;
    window.setAssetsTagFilter = setAssetsTagFilter;
    window.setAssetsSort = setAssetsSort;
    window.toggleAssetsFavoritesOnly = toggleAssetsFavoritesOnly;
    window.toggleAssetsMissingOnly = toggleAssetsMissingOnly;
    window.previewAsset = previewAsset;
    window.dragAsset = dragAsset;
    window.getDraggedAssetPayload = getDraggedAssetPayload;
    window.exportAssetsManifest = exportAssetsManifest;

    document.addEventListener('DOMContentLoaded', async () => {
        setupAssetDrops();
        await loadAssetsLibrary();
        populateDynamicFilters();
    });
})();
