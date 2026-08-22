(function initSceneManager() {
    const AUTOSAVE_DELAY = 900;
    const managerState = {
        scenes: [],
        mode: 'play',
        activeSceneId: null,
        persisted: false,
        saveStatus: 'clean',
        autosaveTimer: null,
        savingPromise: null,
        pendingDirty: false,
        legacyDraft: null,
        missingAssets: []
    };

    window.sceneManagerState = managerState;
    let pendingSceneConfirmation = null;

    function escapeSceneHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    function escapeSceneAttr(value) {
        return escapeSceneHtml(value).replace(/`/g, '&#96;');
    }

    function getBlankSceneState(name = 'Nova cena') {
        return window.normalizeBoardState({
            version: 4,
            sceneId: window.createSceneUidVtt(),
            sceneName: name,
            metadata: {},
            maps: [],
            tokens: [],
            drawings: [],
            fog: {},
            weather: { preset: 'none', config: { ash: 0, rain: 0, sun: 0, wind: 0 } },
            audio: { behavior: 'keep', volume: 0.5 },
            presentation: { introText: '', handout: {} },
            combatState: { active: false, round: 1, currentTurnIndex: 0, participants: [] }
        });
    }

    function readLegacyDirectedDraftOnce() {
        try {
            const raw = localStorage.getItem('cosmere_directed_scene_draft');
            if (raw) managerState.legacyDraft = JSON.parse(raw);
        } catch (error) {
            console.warn('Draft legado do Orquestrador nao pode ser lido.', error);
        }
    }

    function consumeLegacyDirectedDraft() {
        if (!managerState.legacyDraft) return null;
        const legacy = managerState.legacyDraft;
        managerState.legacyDraft = null;
        localStorage.removeItem('cosmere_directed_scene_draft');
        return legacy;
    }

    function updateSaveStatus(status, detail = '') {
        managerState.saveStatus = status;
        const indicator = document.getElementById('scene-save-status');
        if (!indicator) return;
        const labels = {
            clean: 'Salvo', dirty: 'Alteracoes nao salvas', saving: 'Salvando', error: 'Erro ao salvar'
        };
        indicator.dataset.status = status;
        indicator.textContent = detail || labels[status] || status;
    }

    function markSceneDirty(reason = 'scene-change') {
        if (!window.currentSceneState) return;
        updateSaveStatus('dirty');
        if (managerState.savingPromise) {
            managerState.pendingDirty = true;
            return;
        }
        window.clearTimeout(managerState.autosaveTimer);
        if (!managerState.persisted) return;
        managerState.autosaveTimer = window.setTimeout(() => saveCurrentScene({ reason, silent: true }), AUTOSAVE_DELAY);
    }

    async function flushSceneAutosave() {
        window.clearTimeout(managerState.autosaveTimer);
        managerState.autosaveTimer = null;
        if (managerState.savingPromise) await managerState.savingPromise;
        if (managerState.saveStatus === 'dirty' && managerState.persisted) {
            window.clearTimeout(managerState.autosaveTimer);
            managerState.autosaveTimer = null;
            await saveCurrentScene({ silent: true });
        }
    }

    async function saveCurrentScene(options = {}) {
        if (!window.phaserScene || !window.currentSceneState) return null;
        if (managerState.savingPromise) return managerState.savingPromise;
        const name = String(document.getElementById('scene-editor-name')?.value || window.currentSceneName || '').trim();
        if (!name) {
            updateSaveStatus('error', 'Informe o nome da cena');
            return null;
        }

        updateSaveStatus('saving');
        managerState.savingPromise = (async () => {
            const state = window.phaserScene.getBoardState();
            state.sceneName = name;
            state.sceneId = window.currentSceneId || state.sceneId;
            state.metadata = {
                ...(state.metadata || {}),
                createdAt: state.metadata?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            let result;
            if (managerState.persisted) {
                result = await window.api.saveScene(JSON.stringify({ sceneId: state.sceneId, name, state }));
            } else {
                result = await window.api.createScene(JSON.stringify({ sceneId: state.sceneId, name, state }));
                managerState.persisted = true;
                consumeLegacyDirectedDraft();
            }
            window.currentSceneState = window.normalizeBoardState(state, result || {});
            window.currentSceneName = name;
            managerState.activeSceneId = state.sceneId;
            updateSaveStatus('clean');
            await refreshScenesList();
            if (!options.silent && typeof addChatMessage === 'function') {
                addChatMessage('Sistema', `Cena <strong>${escapeSceneHtml(name)}</strong> salva.`, '#22c55e');
            }
            return result;
        })().catch(error => {
            console.error('Erro ao salvar cena.', error);
            updateSaveStatus('error');
            return null;
        }).finally(() => {
            managerState.savingPromise = null;
            if (managerState.pendingDirty) {
                managerState.pendingDirty = false;
                updateSaveStatus('dirty');
                if (managerState.persisted) {
                    managerState.autosaveTimer = window.setTimeout(() => saveCurrentScene({ silent: true }), AUTOSAVE_DELAY);
                }
            }
        });
        return managerState.savingPromise;
    }

    async function refreshScenesList() {
        managerState.scenes = await window.api.listScenes();
        renderScenesList();
        return managerState.scenes;
    }

    function getScenePreviewPath(scene) {
        const preview = scene.mapPreview;
        const asset = preview?.assetId ? window.findSceneAssetVtt(preview.assetId, preview.pathFallback, ['map']) : null;
        return asset && !asset.missing ? asset.path : preview?.pathFallback || '';
    }

    function renderScenesList() {
        const container = document.getElementById('scene-manager-list');
        if (!container) return;
        if (!managerState.scenes.length) {
            container.innerHTML = '<div class="vtt-empty-state"><i class="fas fa-map"></i><span>Nenhuma cena preparada.</span></div>';
            return;
        }
        container.innerHTML = managerState.scenes.map(scene => {
            const preview = getScenePreviewPath(scene);
            const active = scene.sceneId === managerState.activeSceneId;
            const date = scene.updatedAt ? new Date(scene.updatedAt).toLocaleString('pt-BR') : 'Sem data';
            return `
                <article class="scene-card ${active ? 'is-active' : ''}" data-scene-id="${escapeSceneAttr(scene.sceneId)}">
                    <div class="scene-card__preview">
                        ${preview ? `<img src="file://${escapeSceneAttr(preview)}" alt="">` : '<i class="fas fa-map"></i>'}
                        ${active ? '<span>Cena ativa</span>' : ''}
                    </div>
                    <div class="scene-card__body">
                        <strong>${escapeSceneHtml(scene.name)}</strong>
                        <small>Editada em ${escapeSceneHtml(date)}</small>
                    </div>
                    <div class="scene-card__actions">
                        <button class="ui-btn ui-btn--primary" type="button" onclick="playScene('${escapeSceneAttr(scene.sceneId)}')"><i class="fas fa-play"></i> Jogar</button>
                        <button class="ui-btn" type="button" onclick="editScene('${escapeSceneAttr(scene.sceneId)}')"><i class="fas fa-pen-ruler"></i> Preparar</button>
                        <button class="ui-icon-btn" type="button" onclick="duplicateScene('${escapeSceneAttr(scene.sceneId)}')" title="Duplicar"><i class="fas fa-copy"></i></button>
                        <button class="ui-icon-btn" type="button" onclick="renameScene('${escapeSceneAttr(scene.sceneId)}')" title="Renomear"><i class="fas fa-signature"></i></button>
                        <button class="ui-icon-btn ui-icon-btn--danger" type="button" onclick="deleteScene('${escapeSceneAttr(scene.sceneId)}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </article>
            `;
        }).join('');
        window.setupVttTooltips?.();
    }

    async function migrateLegacySceneData(rawState, normalizedState) {
        if (Number(rawState?.version || 0) >= 4) return;
        if (rawState?.sessionState) window.importLegacySessionStateOnce?.(rawState.sessionState);
        if (Array.isArray(rawState?.sceneNotes) && typeof restoreSceneNotesFromBoardState === 'function') {
            restoreSceneNotesFromBoardState({
                sceneId: normalizedState.sceneId,
                sceneName: normalizedState.sceneName,
                sceneNotes: rawState.sceneNotes
            });
        }
    }

    async function loadSceneById(sceneId, options = {}) {
        await flushSceneAutosave();
        const previousName = window.currentSceneName || '';
        const previousSceneId = window.currentSceneId || null;
        if (!window.assetsLibraryState?.assets?.length) await window.loadAssetsLibrary?.();
        const record = await window.api.getScene(sceneId);
        if (!record) return null;
        const rawState = record.state || {};
        const state = window.normalizeBoardState(rawState, {
            sceneId: record.sceneId,
            sceneName: record.name,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        });
        await migrateLegacySceneData(rawState, state);
        managerState.activeSceneId = state.sceneId;
        managerState.persisted = true;
        managerState.missingAssets = [];
        window.currentSceneState = state;
        window.currentSceneName = state.sceneName;
        window.currentSceneId = state.sceneId;
        window.phaserScene.loadBoardState(state);
        window.applySceneStateToEditor?.(state);
        if (options.mode) setAppMode(options.mode);
        if (options.activateAudio) applySceneAudio(state.audio);
        updateSaveStatus(Number(rawState.version || 0) < 4 ? 'dirty' : 'clean');
        if (Number(rawState.version || 0) < 4) markSceneDirty('v3-migration');
        if (previousName && previousName !== state.sceneName) {
            window.addSessionEvent?.('scene_changed', 'Cena alterada', `${previousName} → ${state.sceneName}`, {
                fromSceneId: previousSceneId,
                toSceneId: state.sceneId
            });
        }
        renderScenesList();
        return state;
    }

    function applySceneAudio(audio) {
        const behavior = audio?.behavior || 'keep';
        if (behavior === 'stop') {
            window.stopMusic?.();
            return;
        }
        const asset = window.findSceneAssetVtt(audio?.assetId, audio?.pathFallback, ['audio']);
        if (behavior === 'play' && asset && !asset.missing) window.playMusic?.(asset.path, asset.name || asset.fileName);
        if (behavior === 'play' && (!asset || asset.missing)) reportMissingSceneAsset(audio);
    }

    async function playScene(sceneId) {
        await loadSceneById(sceneId, { mode: 'play', activateAudio: true });
        window.restoreMapLockState?.(true);
        window.closeFlyoutPanel?.();
    }

    async function editScene(sceneId) {
        await loadSceneById(sceneId, { mode: 'prepare' });
        window.openFlyoutPanel?.('scenes-content', 'Cenas');
        showSceneEditor(true);
    }

    async function newScene() {
        await flushSceneAutosave();
        const legacy = managerState.legacyDraft;
        const state = getBlankSceneState(legacy?.sceneName || 'Nova cena');
        if (legacy) {
            state.metadata = {
                ...state.metadata,
                gmText: legacy.gmText || '', objective: legacy.objective || '',
                victory: legacy.victory || '', failure: legacy.failure || ''
            };
            state.presentation.introText = legacy.introText || '';
            state.weather.preset = legacy.weather || 'none';
            if (legacy.mapPath) state.maps = window.normalizeBoardState({ sceneId: state.sceneId, sceneName: state.sceneName, maps: [{ pathFallback: legacy.mapPath }] }).maps;
            state.audio = { ...state.audio, pathFallback: legacy.audioPath || '' };
            state.presentation.handout = { ...state.presentation.handout, pathFallback: legacy.handoutPath || '' };
        }
        managerState.activeSceneId = state.sceneId;
        managerState.persisted = false;
        window.currentSceneState = state;
        window.currentSceneName = state.sceneName;
        window.currentSceneId = state.sceneId;
        window.phaserScene?.loadBoardState(state);
        window.applySceneStateToEditor?.(state);
        setAppMode('prepare');
        showSceneEditor(true);
        updateSaveStatus('dirty');
    }

    function showSceneEditor(visible) {
        document.getElementById('scene-manager-browser')?.classList.toggle('hidden', visible);
        document.getElementById('scene-editor')?.classList.toggle('hidden', !visible);
    }

    function confirmSceneAction(message, confirmLabel = 'Confirmar') {
        if (pendingSceneConfirmation) pendingSceneConfirmation(false);
        const modal = document.getElementById('scene-confirm-modal');
        const messageElement = document.getElementById('scene-confirm-message');
        const confirmButton = document.getElementById('scene-confirm-accept');
        if (!modal || !messageElement || !confirmButton) return Promise.resolve(false);
        messageElement.textContent = message;
        confirmButton.textContent = confirmLabel;
        modal.classList.remove('hidden');
        return new Promise(resolve => {
            pendingSceneConfirmation = resolve;
            confirmButton.focus();
        });
    }

    function resolveSceneConfirmation(accepted) {
        document.getElementById('scene-confirm-modal')?.classList.add('hidden');
        const resolve = pendingSceneConfirmation;
        pendingSceneConfirmation = null;
        resolve?.(Boolean(accepted));
    }

    async function showSceneBrowser() {
        if (!managerState.persisted && window.currentSceneState) {
            if (!await confirmSceneAction('Descartar esta cena ainda nao salva?', 'Descartar')) return;
            window.clearTimeout(managerState.autosaveTimer);
            managerState.autosaveTimer = null;
            consumeLegacyDirectedDraft();
            managerState.activeSceneId = null;
            window.currentSceneState = null;
            window.currentSceneId = '';
            window.currentSceneName = '';
            updateSaveStatus('clean', 'Nenhuma cena ativa');
        }
        showSceneEditor(false);
        refreshScenesList();
    }

    async function renameScene(sceneId) {
        const scene = managerState.scenes.find(item => item.sceneId === sceneId);
        const name = window.prompt('Novo nome da cena:', scene?.name || '');
        if (!name?.trim()) return;
        await window.api.renameScene(JSON.stringify({ sceneId, name: name.trim() }));
        if (managerState.activeSceneId === sceneId) {
            window.currentSceneName = name.trim();
            window.currentSceneState.sceneName = name.trim();
            window.applySceneStateToEditor?.(window.currentSceneState);
        }
        await refreshScenesList();
    }

    async function duplicateScene(sceneId) {
        const source = managerState.scenes.find(item => item.sceneId === sceneId);
        const name = window.prompt('Nome da copia:', `${source?.name || 'Cena'} - Copia`);
        if (!name?.trim()) return;
        const duplicated = await window.api.duplicateScene(JSON.stringify({ sceneId, name: name.trim() }));
        if (duplicated) window.linkNotesToDuplicatedScene?.(sceneId, duplicated.sceneId);
        await refreshScenesList();
    }

    async function deleteScene(sceneId) {
        const scene = managerState.scenes.find(item => item.sceneId === sceneId);
        if (!await confirmSceneAction(`Excluir a cena "${scene?.name || 'sem nome'}"? Esta acao nao pode ser desfeita.`, 'Excluir cena')) return;
        if (managerState.activeSceneId === sceneId) {
            window.clearTimeout(managerState.autosaveTimer);
            managerState.autosaveTimer = null;
            managerState.persisted = false;
            managerState.activeSceneId = null;
            window.currentSceneState = null;
            window.currentSceneId = '';
            window.currentSceneName = '';
        }
        await window.api.deleteScene(sceneId);
        await refreshScenesList();
    }

    function setAppMode(mode) {
        managerState.mode = mode === 'prepare' ? 'prepare' : 'play';
        document.body.dataset.appMode = managerState.mode;
        document.querySelectorAll('[data-app-mode-button]').forEach(button => {
            button.classList.toggle('active', button.dataset.appModeButton === managerState.mode);
        });
        const label = document.getElementById('app-mode-label');
        if (label) label.textContent = managerState.mode === 'prepare' ? 'PREPARAR' : 'JOGAR';
    }

    function openSceneSwitcher() {
        showSceneEditor(false);
        window.openFlyoutPanel?.('scenes-content', 'Trocar Cena');
        refreshScenesList();
    }

    function presentCurrentScene() {
        const presentation = window.currentSceneState?.presentation;
        if (!presentation) return;
        if (presentation.introText) {
            addChatMessage('Cena', `<strong>${escapeSceneHtml(window.currentSceneName || 'Introducao')}</strong>: ${escapeSceneHtml(presentation.introText)}`, '#38bdf8');
        }
        const handout = presentation.handout;
        const asset = window.findSceneAssetVtt(handout?.assetId, handout?.pathFallback, ['image', 'video', 'handout']);
        if (asset && !asset.missing) {
            window.showHandoutPathLocally?.(asset.path, handout.type || asset.type, asset.name || asset.fileName);
            window.addSessionEvent?.('handout_revealed', 'Apresentacao da cena', asset.name || window.currentSceneName, { assetId: asset.id });
        } else if (handout?.assetId || handout?.pathFallback) reportMissingSceneAsset(handout);
    }

    function reportMissingSceneAsset(reference) {
        const key = reference?.assetId || reference?.pathFallback || reference?.path;
        if (!key || managerState.missingAssets.some(item => item.key === key)) return;
        managerState.missingAssets.push({ key, reference });
        window.renderSceneMissingAssets?.(managerState.missingAssets);
    }

    function exportBoardBackup() {
        if (!window.phaserScene) return;
        const state = window.phaserScene.getBoardState();
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `cosmere_scene_${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function importBoardBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const raw = JSON.parse(reader.result);
                    const state = window.normalizeBoardState({ ...raw, sceneId: window.createSceneUidVtt(), sceneName: `${raw.sceneName || 'Cena importada'} - Importada` });
                    managerState.persisted = false;
                    managerState.activeSceneId = state.sceneId;
                    window.currentSceneState = state;
                    window.currentSceneId = state.sceneId;
                    window.currentSceneName = state.sceneName;
                    window.phaserScene.loadBoardState(state);
                    window.applySceneStateToEditor?.(state);
                    setAppMode('prepare');
                    showSceneEditor(true);
                    updateSaveStatus('dirty');
                } catch (error) {
                    console.error('Backup de cena invalido.', error);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    Object.assign(window, {
        refreshScenesList, saveCurrentScene, flushSceneAutosave, markSceneDirty,
        playScene, editScene, newScene, renameScene, duplicateScene, deleteScene,
        showSceneBrowser, openSceneSwitcher, setAppMode, presentCurrentScene,
        reportMissingSceneAsset, exportBoardBackup, importBoardBackup,
        resolveSceneConfirmation
    });

    document.addEventListener('DOMContentLoaded', async () => {
        readLegacyDirectedDraftOnce();
        setAppMode('play');
        updateSaveStatus('clean', 'Nenhuma cena ativa');
        await refreshScenesList();
    });
})();
