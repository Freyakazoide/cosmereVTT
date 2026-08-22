(function initSceneEditor() {
    const WEATHER_PRESETS = {
        none: { ash: 0, rain: 0, sun: 0, wind: 0 },
        rain: { ash: 0, rain: 65, sun: 0, wind: 20 },
        ash: { ash: 70, rain: 0, sun: 0, wind: 18 },
        sun: { ash: 0, rain: 0, sun: 75, wind: 0 },
        storm: { ash: 0, rain: 90, sun: 0, wind: 80 }
    };
    let pickerTarget = null;
    let pickerTypes = [];

    function getEditorState() {
        if (!window.currentSceneState) window.currentSceneState = window.normalizeBoardState({});
        return window.currentSceneState;
    }

    function setValue(id, value) {
        const element = document.getElementById(id);
        if (element && document.activeElement !== element) element.value = value ?? '';
    }

    function setChecked(id, value) {
        const element = document.getElementById(id);
        if (element) element.checked = Boolean(value);
    }

    function getAssetLabel(reference, types) {
        const asset = window.findSceneAssetVtt?.(reference?.assetId, reference?.pathFallback, types);
        if (asset && !asset.missing) return asset.name || asset.fileName;
        if (reference?.assetId || reference?.pathFallback) return 'Recurso nao encontrado';
        return 'Nenhum recurso selecionado';
    }

    function applySceneStateToEditor(state) {
        if (!state) return;
        setValue('scene-editor-name', state.sceneName);
        setValue('scene-editor-gm-text', state.metadata?.gmText);
        setValue('scene-editor-objective', state.metadata?.objective);
        setValue('scene-editor-victory', state.metadata?.victory);
        setValue('scene-editor-failure', state.metadata?.failure);
        setValue('scene-editor-weather', state.weather?.preset || 'none');
        setValue('scene-editor-audio-behavior', state.audio?.behavior || 'keep');
        setValue('scene-editor-audio-volume', state.audio?.volume ?? 0.5);
        setValue('scene-editor-intro', state.presentation?.introText);
        setValue('scene-grid-size-editor', state.sceneSettings?.gridSize || 70);
        setValue('scene-grid-offset-x', state.sceneSettings?.gridOffsetX || 0);
        setValue('scene-grid-offset-y', state.sceneSettings?.gridOffsetY || 0);
        setValue('scene-distance-cell-editor', state.sceneSettings?.distancePerCell || 2);
        setValue('scene-distance-unit-editor', state.sceneSettings?.distanceUnit || 'm');
        setChecked('scene-grid-enabled-editor', state.sceneSettings?.gridEnabled !== false);
        setChecked('scene-grid-snap-editor', state.sceneSettings?.snapToGrid !== false);
        const map = state.maps?.[0];
        const mapLabel = document.getElementById('scene-map-asset-label');
        const audioLabel = document.getElementById('scene-audio-asset-label');
        const handoutLabel = document.getElementById('scene-handout-asset-label');
        if (mapLabel) mapLabel.textContent = getAssetLabel(map, ['map']);
        if (audioLabel) audioLabel.textContent = getAssetLabel(state.audio, ['audio']);
        if (handoutLabel) handoutLabel.textContent = getAssetLabel(state.presentation?.handout, ['image', 'video', 'handout']);
        renderSceneEditorNotes();
        const missing = [
            ...(state.maps || []).filter(item => item.missing).map(item => ({ key: item.assetId || item.pathFallback, target: 'map' })),
            ...(state.audio?.missing ? [{ key: state.audio.assetId || state.audio.pathFallback, target: 'audio' }] : []),
            ...(state.presentation?.handout?.missing ? [{ key: state.presentation.handout.assetId || state.presentation.handout.pathFallback, target: 'handout' }] : []),
            ...((window.sceneManagerState?.missingAssets || []).map(item => ({ ...item, target: item.target || 'map' })))
        ].filter(item => item.key);
        renderSceneMissingAssets(missing);
    }

    function updateSceneEditorField(section, key, value) {
        const state = getEditorState();
        if (section === 'root') state[key] = value;
        else state[section] = { ...(state[section] || {}), [key]: value };
        if (section === 'root' && key === 'sceneName') {
            window.currentSceneName = value;
            state.sceneName = value;
        }
        window.markSceneDirty?.(`editor-${section}-${key}`);
    }

    function updateSceneWeather(preset) {
        const state = getEditorState();
        state.weather = { preset, config: { ...(WEATHER_PRESETS[preset] || WEATHER_PRESETS.none) } };
        window.phaserScene?.setAdvancedWeather?.(state.weather.config);
        window.markSceneDirty?.('weather');
    }

    function updateEditorGridSetting(key, rawValue) {
        const state = getEditorState();
        let value = rawValue;
        if (['gridSize', 'gridOffsetX', 'gridOffsetY', 'distancePerCell'].includes(key)) value = Number(rawValue) || 0;
        if (['gridEnabled', 'snapToGrid'].includes(key)) value = Boolean(rawValue);
        state.sceneSettings = { ...(state.sceneSettings || {}), [key]: value };
        window.phaserScene?.applySceneSettings?.(state.sceneSettings);
        window.markSceneDirty?.(`grid-${key}`);
    }

    function setSceneEditorTab(tabName, button) {
        document.querySelectorAll('.scene-editor-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.sceneEditorTab === tabName));
        document.querySelectorAll('.scene-editor-section').forEach(section => section.classList.toggle('active', section.dataset.sceneEditorSection === tabName));
        if (button) {
            document.querySelectorAll('.scene-editor-tab').forEach(tab => tab.classList.remove('is-selected'));
            button.classList.add('is-selected');
        }
    }

    async function openSceneAssetPicker(target) {
        pickerTarget = target;
        pickerTypes = target === 'map' ? ['map'] : target === 'audio' ? ['audio'] : ['image', 'video', 'handout'];
        await window.loadAssetsLibrary?.();
        const modal = document.getElementById('scene-asset-picker');
        if (modal) modal.classList.remove('hidden');
        const search = document.getElementById('scene-asset-picker-search');
        if (search) search.value = '';
        renderSceneAssetPicker();
    }

    function closeSceneAssetPicker() {
        document.getElementById('scene-asset-picker')?.classList.add('hidden');
        pickerTarget = null;
    }

    function renderSceneAssetPicker() {
        const grid = document.getElementById('scene-asset-picker-grid');
        if (!grid) return;
        const search = String(document.getElementById('scene-asset-picker-search')?.value || '').toLowerCase();
        const assets = (window.assetsLibraryState?.assets || [])
            .filter(asset => pickerTypes.includes(asset.type))
            .filter(asset => !search || [asset.name, asset.fileName, asset.category, ...(asset.tags || [])].join(' ').toLowerCase().includes(search));
        if (!assets.length) {
            grid.innerHTML = '<div class="vtt-empty-state"><i class="fas fa-box-open"></i><span>Nenhum asset encontrado.</span></div>';
            return;
        }
        grid.innerHTML = assets.map(asset => `
            <button class="scene-asset-choice ${asset.missing ? 'is-missing' : ''}" type="button" onclick="selectSceneAsset('${escapeAttr(asset.id)}')">
                <span class="scene-asset-choice__preview">${renderPickerPreview(asset)}</span>
                <strong>${escapeHtml(asset.name || asset.fileName)}</strong>
                <small>${escapeHtml(asset.category || asset.type)}${asset.missing ? ' · Recurso nao encontrado' : ''}</small>
            </button>
        `).join('');
    }

    function renderPickerPreview(asset) {
        if (asset.missing) return '<i class="fas fa-triangle-exclamation"></i>';
        if (asset.type === 'audio') return '<i class="fas fa-music"></i>';
        if (asset.type === 'video') return `<video src="file://${escapeAttr(asset.path)}" muted></video>`;
        return `<img src="file://${escapeAttr(asset.path)}" alt="">`;
    }

    function selectSceneAsset(assetId) {
        const asset = (window.assetsLibraryState?.assets || []).find(item => item.id === assetId);
        if (!asset || asset.missing || !pickerTarget) return;
        const reference = { assetId: asset.id, pathFallback: asset.path, missing: false };
        const state = getEditorState();
        if (pickerTarget === 'map') {
            state.maps = [{
                ...reference, textureKey: `map_${asset.id}`, x: 0, y: 0,
                scaleX: 1, scaleY: 1, width: null, height: null, locked: true
            }];
            window.phaserScene?.replaceSceneMapAsset?.(asset);
        } else if (pickerTarget === 'audio') {
            state.audio = { ...(state.audio || {}), ...reference };
        } else {
            state.presentation = {
                ...(state.presentation || {}),
                handout: { ...reference, type: asset.type === 'video' ? 'video' : 'image' }
            };
        }
        window.markSceneDirty?.(`asset-${pickerTarget}`);
        closeSceneAssetPicker();
        applySceneStateToEditor(state);
    }

    function removeSceneAsset(target) {
        const state = getEditorState();
        if (target === 'map') {
            state.maps = [];
            window.phaserScene?.clearSceneMaps?.();
        } else if (target === 'audio') {
            state.audio = { behavior: state.audio?.behavior || 'keep', volume: state.audio?.volume ?? 0.5, assetId: null, pathFallback: '', missing: false };
        } else {
            state.presentation = { ...(state.presentation || {}), handout: { assetId: null, pathFallback: '', missing: false, type: 'image' } };
        }
        window.markSceneDirty?.(`asset-remove-${target}`);
        applySceneStateToEditor(state);
    }

    function adjustSceneMap(action) {
        const scene = window.phaserScene;
        const map = scene?.mapasAtivos?.[0];
        if (!scene || !map) return;
        const view = scene.cameras.main.worldView;
        if (action === 'scale-up') map.setScale(map.scaleX * 1.05, map.scaleY * 1.05);
        if (action === 'scale-down') map.setScale(map.scaleX * 0.95, map.scaleY * 0.95);
        if (action === 'center') map.setPosition(view.centerX, view.centerY);
        if (action === 'reset') map.setPosition(view.centerX, view.centerY).setScale(1);
        if (action === 'lock') window.toggleMapLock?.();
        window.markSceneDirty?.(`map-${action}`);
    }

    function renderSceneEditorNotes() {
        const container = document.getElementById('scene-editor-notes');
        if (!container) return;
        const notes = window.getScenePinnedNotes?.() || [];
        container.innerHTML = notes.length ? notes.map(note => `
            <article class="scene-note-link"><i class="fas fa-thumbtack"></i><span><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(note.type || 'Nota')}</small></span></article>
        `).join('') : '<div class="vtt-empty-state"><span>Nenhuma pista vinculada a esta cena.</span></div>';
    }

    function renderSceneMissingAssets(items) {
        const container = document.getElementById('scene-missing-assets');
        if (!container) return;
        container.classList.toggle('hidden', !items.length);
        container.innerHTML = items.map(item => `
            <div class="scene-missing-asset"><i class="fas fa-triangle-exclamation"></i><span>Recurso nao encontrado: ${escapeHtml(item.key)}</span><button class="ui-btn" type="button" onclick="openSceneAssetPicker('${escapeAttr(item.target || 'map')}')">Substituir</button></div>
        `).join('');
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    Object.assign(window, {
        applySceneStateToEditor, updateSceneEditorField, updateSceneWeather,
        updateEditorGridSetting, setSceneEditorTab, openSceneAssetPicker,
        closeSceneAssetPicker, renderSceneAssetPicker, selectSceneAsset,
        removeSceneAsset, adjustSceneMap, renderSceneEditorNotes, renderSceneMissingAssets
    });
})();
