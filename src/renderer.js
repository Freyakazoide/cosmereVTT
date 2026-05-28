const PIXELS_POR_UNIDADE = 70;
const METROS_POR_QUADRADO = 2;

function normalizarCaminhoVtt(path) {
    return String(path || '').replace(/\\/g, '/');
}

function limparExtensaoVtt(nome) {
    return String(nome || '').replace(/\.[^/.]+$/, '');
}

function escaparHtmlVtt(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escaparJsVtt(valor) {
    return String(valor || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ');
}

function nomeArquivoVtt(item, fallback = 'arquivo-sem-nome') {
    const rawName = item?.name || item?.fileName || '';
    const rawPath = item?.path || item || '';
    const pathName = String(rawPath || '').split(/[\\/]/).pop();
    return rawName || pathName || fallback;
}

function renderVttLibraryCard({
    icon = 'fa-solid fa-diamond',
    title = 'Item sem nome',
    fileName = '',
    subtitle = 'Recurso da mesa',
    meta = '',
    path = '',
    preview = '',
    previewType = 'icon',
    onClick = '',
    actions = '',
    variant = ''
}) {
    const normalizedPath = normalizarCaminhoVtt(path);
    const normalizedPreview = normalizarCaminhoVtt(preview || path);
    const resolvedFileName = fileName || title || nomeArquivoVtt(path);
    const resolvedTitle = title || limparExtensaoVtt(resolvedFileName);
    const displayVariant = variant === 'audio'
        ? 'audio'
        : (['map', 'image', 'video'].includes(variant) ? 'visual' : (variant || 'compact'));

    const safeTitle = escaparHtmlVtt(resolvedTitle);
    const safeFileName = escaparHtmlVtt(resolvedFileName);
    const safeSubtitle = escaparHtmlVtt(subtitle);
    const safeMeta = escaparHtmlVtt(meta);
    const safePath = escaparHtmlVtt(normalizedPath);
    const safeVariant = escaparHtmlVtt(variant);
    const safeDisplayVariant = escaparHtmlVtt(displayVariant);
    const safeIcon = escaparHtmlVtt(icon);
    const titleText = safePath ? `${safeTitle} - ${safePath}` : safeTitle;

    let previewHtml = `
        <span class="vtt-library-preview vtt-library-preview--icon">
            <i class="${safeIcon}"></i>
        </span>
    `;

    if (normalizedPreview && previewType === 'image') {
        previewHtml = `
            <span class="vtt-library-preview vtt-library-preview--image">
                <img src="file://${normalizedPreview}" alt="${safeTitle}" loading="lazy">
            </span>
        `;
    }

    if (normalizedPreview && previewType === 'video') {
        previewHtml = `
            <span class="vtt-library-preview vtt-library-preview--video">
                <video src="file://${normalizedPreview}" muted preload="metadata"></video>
                <i class="fas fa-play"></i>
            </span>
        `;
    }

    if (displayVariant === 'audio') {
        return `
            <article class="vtt-library-card vtt-library-card--audio vtt-library-card--row" title="${titleText}" data-vtt-path="${safePath}">
                <button class="vtt-library-card__main-action" type="button" onclick="${onClick}">
                    <span class="vtt-library-row-icon"><i class="${safeIcon}"></i></span>
                    <span class="vtt-library-card__content">
                        <strong class="vtt-library-card__filename">${safeFileName}</strong>
                        <span class="vtt-library-card__meta-line">
                            <small>${safeSubtitle}</small>
                            ${safeMeta ? `<em>${safeMeta}</em>` : ''}
                        </span>
                    </span>
                </button>

                ${actions ? `<div class="vtt-library-card__actions">${actions}</div>` : ''}
            </article>
        `;
    }

    return `
        <article class="vtt-library-card ${safeVariant ? `vtt-library-card--${safeVariant}` : ''} vtt-library-card--${safeDisplayVariant}" title="${titleText}" data-vtt-path="${safePath}">
            <button class="vtt-library-card__main-action" type="button" onclick="${onClick}">
                ${previewHtml}

                <span class="vtt-library-card__content">
                    <strong class="vtt-library-card__filename">${safeFileName}</strong>
                    <span class="vtt-library-card__meta-line">
                        <small>${safeSubtitle}</small>
                    </span>
                    ${safeMeta ? `<em>${safeMeta}</em>` : ''}
                </span>
            </button>

            ${actions ? `<div class="vtt-library-card__actions">${actions}</div>` : ''}
        </article>
    `;
}

function renderVttCategoryHeader(title, count = null) {
    const safeTitle = escaparHtmlVtt(title || 'Sem categoria');
    const counter = Number.isFinite(count) ? `<span>${count}</span>` : '';

    return `
        <div class="vtt-category-header">
            <strong>${safeTitle}</strong>
            ${counter}
        </div>
    `;
}

function renderVttLibraryOverview({ icon = 'fa-solid fa-layer-group', title = 'Biblioteca', subtitle = '', count = 0 } = {}) {
    return `
        <div class="vtt-library-overview">
            <span class="vtt-library-overview__icon"><i class="${escaparHtmlVtt(icon)}"></i></span>
            <span class="vtt-library-overview__copy">
                <strong>${escaparHtmlVtt(title)}</strong>
                ${subtitle ? `<small>${escaparHtmlVtt(subtitle)}</small>` : ''}
            </span>
            <span class="vtt-library-overview__count">${Number(count) || 0}</span>
        </div>
    `;
}

function renderVttEmptyState(message = 'Nenhum recurso encontrado.') {
    return `
        <div class="vtt-empty-state vtt-empty-state--library">
            <i class="fas fa-folder-open"></i>
            <span>${escaparHtmlVtt(message)}</span>
        </div>
    `;
}

function renderVttGroupedLibrary(groups, renderItem, emptyMessage) {
    const entries = Object.keys(groups || {}).sort((a, b) => a.localeCompare(b));
    if (entries.length === 0) return renderVttEmptyState(emptyMessage);

    return entries.map(cat => {
        const items = [...(groups[cat] || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        return `
            ${renderVttCategoryHeader(cat, items.length)}
            <div class="vtt-library-stack">
                ${items.map(item => renderItem(item, cat)).join('') || renderVttEmptyState(emptyMessage)}
            </div>
        `;
    }).join('');
}

function criarSceneIdVtt(nome) {
    const value = String(nome || '').trim();
    if (!value) return 'campaign';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'campaign';
}

function getDefaultCombatStateVtt() {
    return {
        active: false,
        round: 1,
        currentTurnIndex: 0,
        participants: []
    };
}

function getDefaultSessionStateVtt() {
    return {
        active: false,
        sessionName: '',
        startedAt: null,
        endedAt: null,
        events: []
    };
}

function getDefaultSceneSettingsVtt() {
    return {
        gridEnabled: true,
        gridSize: PIXELS_POR_UNIDADE,
        snapToGrid: true,
        distancePerCell: METROS_POR_QUADRADO,
        distanceUnit: 'm'
    };
}

function normalizeBoardAssetListVtt(primary, fallback) {
    if (Array.isArray(primary)) return primary;
    if (Array.isArray(fallback)) return fallback;
    return [];
}

function normalizeBoardState(state, options = {}) {
    const source = state && typeof state === 'object' ? state : {};
    const sceneName = source.sceneName || source.sceneDirector?.sceneName || options.sceneName || window.currentSceneName || '';
    const sceneId = source.sceneId || (sceneName ? criarSceneIdVtt(sceneName) : '');
    const mapas = normalizeBoardAssetListVtt(source.mapas, source.maps).map(mapa => ({
        ...(mapa || {}),
        key: mapa?.key || mapa?.textureKey || '',
        textureKey: mapa?.textureKey || mapa?.key || '',
        path: mapa?.path || mapa?.caminhoAbsoluto || ''
    }));
    const tokens = normalizeBoardAssetListVtt(source.tokens, []).map(token => ({
        ...(token || {}),
        key: token?.key || token?.textureKey || '',
        textureKey: token?.textureKey || token?.key || '',
        path: token?.path || token?.caminhoAbsoluto || '',
        elev: token?.elev ?? token?.elevation ?? '',
        elevation: token?.elevation ?? token?.elev ?? '',
        gridSize: token?.gridSize || 1,
        visibleToPlayers: token?.visibleToPlayers !== false,
        locked: !!token?.locked,
        notes: token?.notes || '',
        conditions: Array.isArray(token?.conditions) ? token.conditions : []
    }));
    const sceneSettings = {
        ...getDefaultSceneSettingsVtt(),
        ...(window.sceneSettings || {}),
        ...(source.sceneSettings || {}),
        ...(source.grid || {})
    };
    sceneSettings.gridSize = Number(sceneSettings.gridSize || sceneSettings.size) || PIXELS_POR_UNIDADE;
    sceneSettings.gridEnabled = sceneSettings.gridEnabled ?? sceneSettings.visible ?? true;
    sceneSettings.distancePerCell = Number(sceneSettings.distancePerCell || sceneSettings.metersPerSquare) || METROS_POR_QUADRADO;
    sceneSettings.distanceUnit = sceneSettings.distanceUnit || 'm';

    const grid = {
        visible: source.grid?.visible ?? sceneSettings.gridEnabled,
        size: Number(source.grid?.size || sceneSettings.gridSize) || PIXELS_POR_UNIDADE,
        metersPerSquare: Number(source.grid?.metersPerSquare || sceneSettings.distancePerCell) || METROS_POR_QUADRADO
    };
    const fogAlpha = Number(source.fog?.alpha ?? source.fogOpacity ?? 0.9);
    const fog = {
        ...(source.fog || {}),
        alpha: Number.isFinite(fogAlpha) ? fogAlpha : 0.9,
        mode: source.fog?.mode || window.toolConfig?.fogMode || 'reveal',
        snapshot: source.fog?.snapshot || null
    };
    const combatState = {
        ...getDefaultCombatStateVtt(),
        ...(source.combatState || {}),
        participants: Array.isArray(source.combatState?.participants) ? source.combatState.participants : []
    };
    const sessionState = {
        ...getDefaultSessionStateVtt(),
        ...(source.sessionState || {}),
        events: Array.isArray(source.sessionState?.events) ? source.sessionState.events : []
    };
    const pinnedNotes = Array.isArray(source.pinnedNotes) ? source.pinnedNotes : [];
    const revealedNotes = Array.isArray(source.revealedNotes) ? source.revealedNotes : [];
    const sceneNotes = Array.isArray(source.sceneNotes)
        ? source.sceneNotes
        : [
            ...pinnedNotes,
            ...revealedNotes.filter(note => !pinnedNotes.some(pinned => pinned?.id && pinned.id === note?.id))
        ];

    return {
        ...source,
        version: Math.max(Number(source.version) || 1, 2),
        sceneName,
        sceneId,
        camera: {
            x: Number(source.camera?.x) || 0,
            y: Number(source.camera?.y) || 0,
            zoom: Number(source.camera?.zoom) || 1
        },
        grid,
        sceneSettings,
        combatState,
        sessionState,
        weather: source.weather || null,
        fog,
        fogOpacity: fog.alpha,
        mapas,
        maps: mapas,
        tokens,
        drawings: Array.isArray(source.drawings) ? source.drawings : [],
        initiative: Array.isArray(source.initiative) ? source.initiative : [],
        round: source.round || combatState.round || 1,
        audio: {
            currentTrack: source.audio?.currentTrack || null,
            volume: Number(source.audio?.volume ?? 0.5)
        },
        pinnedNotes,
        revealedNotes,
        sceneNotes,
        revealedHandouts: Array.isArray(source.revealedHandouts) ? source.revealedHandouts : [],
        sceneDirector: source.sceneDirector || null
    };
}

window.normalizeBoardState = normalizeBoardState;

function isPlayerViewModeVtt() {
    return window.isPlayerView || window.location.search.includes('player=true');
}

function filterPlayerSafeBoardState(state) {
    const normalized = typeof normalizeBoardState === 'function'
        ? normalizeBoardState(state)
        : (state || {});
    const visibleTokens = (normalized.tokens || []).filter(token => token.visibleToPlayers !== false);
    const visibleTokenIds = new Set(visibleTokens.map(token => token.tokenId || token.characterId || token.id).filter(Boolean));

    return {
        ...normalized,
        tokens: visibleTokens,
        drawings: (normalized.drawings || []).filter(drawing => drawing.visibleToPlayers !== false),
        combatState: {
            ...(normalized.combatState || getDefaultCombatStateVtt()),
            participants: (normalized.combatState?.participants || []).filter(participant => {
                if (!participant?.id) return true;
                return visibleTokenIds.has(participant.id);
            })
        }
    };
}

window.filterPlayerSafeBoardState = filterPlayerSafeBoardState;

window.getPlayerSafeBoardState = function getPlayerSafeBoardState() {
    if (!window.phaserScene?.getBoardState) return null;
    return filterPlayerSafeBoardState(window.phaserScene.getBoardState());
};

function getTokenVisibilityIdVtt(token) {
    return token?.tokenId || token?.characterId || token?.id || '';
}

function isTokenVisibleToPlayersVtt(token) {
    if (!token) return false;
    const tokenId = getTokenVisibilityIdVtt(token);
    const linkedFicha = tokenId && window.fichasSalvas ? window.fichasSalvas[tokenId] : null;
    return token.visibleToPlayers !== false && linkedFicha?.isVisibleToPlayers !== false;
}

window.isTokenVisibleToPlayersVtt = isTokenVisibleToPlayersVtt;



class MainScene extends Phaser.Scene {
    constructor() { super({ key: 'MainScene' }); }

    create() {
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        
        this.camadaMapa = this.add.layer();
        this.camadaGrid = this.add.layer();
        this.camadaTatico = this.add.layer(); 
        this.camadaTokens = this.add.layer();
        
        // --- CAMADA DA NEBLINA DE GUERRA (FOG) ---
        this.camadaFog = this.add.layer();
        this.isFogCovered = false;
        const initialFogSize = this.getMaxFogTextureSize();
        this.createFogRenderTexture(-initialFogSize / 2, -initialFogSize / 2, initialFogSize, initialFogSize);
        
        this.fogBrush = this.add.graphics().fillStyle(0xffffff, 1).fillCircle(0, 0, PIXELS_POR_UNIDADE * 1.5).setVisible(false);
        this.fogBrushDark = this.add.graphics().fillStyle(0x000000, 1).fillCircle(0, 0, PIXELS_POR_UNIDADE * 1.5).setVisible(false);

       // --- SISTEMA DE CLIMA (PARTÍCULAS AVANÇADAS E SOL) ---
        this.camadaClima = this.add.layer();
        
        const ash = this.add.graphics().fillStyle(0x888888, 1).fillCircle(3,3,3);
        ash.generateTexture('cinzas', 6, 6); ash.destroy();
        const rain = this.add.graphics().fillStyle(0x93c5fd, 0.8).fillRect(0,0,2,25);
        rain.generateTexture('chuva', 2, 25); rain.destroy();

        this.ashEmitter = this.add.particles(0, 0, 'cinzas', { blendMode: 'NORMAL' });
        this.rainEmitter = this.add.particles(0, 0, 'chuva', { blendMode: 'NORMAL' });
        this.camadaClima.add(this.ashEmitter);
        this.camadaClima.add(this.rainEmitter);
        this.ashEmitter.stop();
        this.rainEmitter.stop();

        // Filtro de Sol Alaranjado de Roshar
       this.sunOverlay = this.add.rectangle(0, 0, 15000, 15000, 0xff9900).setOrigin(0.5).setBlendMode('ADD').setAlpha(0).setScrollFactor(0);
        this.camadaClima.add(this.sunOverlay);

        this.camadaUI = this.add.layer();
        this.camadaUI.setDepth(999);

        this.ferramentaAtual = 'select'; 
        this.isDrawing = false;
        this.interactionStart = { x: 0, y: 0 };
        this.mapLocked = false;
        this.sceneSettings = { ...(window.sceneSettings || {}) };
        window.sceneSettings = this.sceneSettings;
        this.currentTurnMarker = null;
        this.drawingHistory = [];
        this.redoHistory = [];

        this.previewGraphics = this.add.graphics();
        this.camadaUI.add(this.previewGraphics);

        this.graficosRegua = this.add.graphics();
        this.camadaUI.add(this.graficosRegua);
        this.textoRegua = this.add.text(0, 0, '', { font: '20px Arial', fill: '#ffffff', backgroundColor: '#000000aa' }).setOrigin(0.5).setVisible(false);
        this.camadaUI.add(this.textoRegua);

        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 2) {
                const pMundo = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                const clickedToken = this.camadaTokens?.list?.find(t => {
                    const dx = Math.abs(t.x - pMundo.x);
                    const dy = Math.abs(t.y - pMundo.y);
                    return dx < t.displayWidth / 2 && dy < t.displayHeight / 2;
                });
                if (!clickedToken && window.showMapContextMenu) {
                    window.showMapContextMenu(pointer.event.clientX, pointer.event.clientY);
                }
                return;
            }
            const pMundo = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

            // --- SISTEMA DE PING CONSERTADO (Pulsando) ---
            if (pointer.event.altKey) {
                const ping = this.add.graphics();
                ping.lineStyle(4, 0xfbbf24, 1);
                ping.strokeCircle(0, 0, 15);
                ping.setPosition(pMundo.x, pMundo.y);
                this.camadaUI.add(ping);
                
                this.tweens.add({
                    targets: ping,
                    scaleX: 4, scaleY: 4, alpha: 0.2,
                    duration: 500,
                    yoyo: true,
                    repeat: 2,
                    ease: 'Sine.easeInOut',
                    onComplete: () => ping.destroy()
                });

                if (window.api && window.api.syncPing) {
                    window.api.syncPing({ x: pMundo.x, y: pMundo.y });
                }
                return;
            }

            this.isDrawing = true;
            this.interactionStart = { x: pMundo.x, y: pMundo.y };

            if (this.ferramentaAtual === 'draw') {
                const cfg = window.toolConfig;
                this.currentDrawingPath = this.add.graphics().lineStyle(cfg.thickness, cfg.color, 1);
                this.currentDrawingPath.drawingMeta = {
                    type: 'freehand',
                    color: cfg.color,
                    thickness: cfg.thickness,
                    points: [{ x: pMundo.x, y: pMundo.y }]
                };
                this.currentDrawingPath.beginPath();
                this.currentDrawingPath.moveTo(pMundo.x, pMundo.y);
                this.camadaTatico.add(this.currentDrawingPath);
            } else if (this.ferramentaAtual === 'fog') {
                this.applyFogAt(pMundo);
            }
        });

        this.input.on('pointermove', (pointer) => {
            const pMundo = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

            // Pan livre liberado em todas as ferramentas com botão direito
            if (pointer.isDown && pointer.button === 2) {
                this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
                this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
                return;
            }

            // Trava de segurança do mouse
            if (!pointer.isDown) {
                this.isDrawing = false;
                this.isMeasuring = false;
                this.previewGraphics.clear();
                return;
            }

           if (!this.isDrawing) return;

            if (this.ferramentaAtual === 'eraser') {
                // Borracha de varredura real: destrói qualquer desenho que o ponteiro encostar
                const pointerRect = new Phaser.Geom.Rectangle(pMundo.x - 10, pMundo.y - 10, 20, 20);
                this.camadaTatico.list.forEach(obj => {
                    if (obj.getBounds && Phaser.Geom.Intersects.RectangleToRectangle(pointerRect, obj.getBounds())) {
                        obj.destroy();
                    }
                });
            } else if (this.ferramentaAtual === 'draw') {
                this.currentDrawingPath.lineTo(pMundo.x, pMundo.y);
                if (this.currentDrawingPath.drawingMeta) {
                    this.currentDrawingPath.drawingMeta.points.push({ x: pMundo.x, y: pMundo.y });
                }
                this.currentDrawingPath.strokePath();
            }
            else if (this.ferramentaAtual === 'fog') {
                this.applyFogAt(pMundo);
                /*
                const relX = pMundo.x - this.fogRT.x + (this.fogRT.width / 2);
                const relY = pMundo.y - this.fogRT.y + (this.fogRT.height / 2);
                
                console.log(`[VTT FOG] Desenhando Névoa. X:${relX}, Y:${relY} | Modo: ${window.toolConfig.fogMode}`);
                
                if (window.toolConfig.fogMode === 'reveal') {
                    this.fogRT.erase(this.fogBrush, relX, relY); 
                } else {
                    this.fogRT.draw(this.fogBrushDark, relX, relY); 
                }
                */
            }
            else if (this.ferramentaAtual === 'ruler') {
                this.graficosRegua.clear().lineStyle(2, 0xff6400, 1);
                this.graficosRegua.strokeLineShape(new Phaser.Geom.Line(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y));
                const settings = this.getSceneSettings();
                const distance = (Phaser.Math.Distance.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y) / this.getSceneGridSize()) * settings.distancePerCell;
                this.textoRegua.setVisible(true).setPosition(pMundo.x, pMundo.y - 20).setText(`${distance.toFixed(1)} ${settings.distanceUnit || 'm'}`);
            }
            else if (this.ferramentaAtual === 'aoe') {
                const cfg = window.toolConfig;
                this.previewGraphics.clear();
                this.previewGraphics.fillStyle(cfg.color, 0.3).lineStyle(2, cfg.color, 0.8);
                
                const dist = Phaser.Math.Distance.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y);

                if (cfg.shape === 'circle') {
                    this.previewGraphics.fillCircle(this.interactionStart.x, this.interactionStart.y, dist).strokeCircle(this.interactionStart.x, this.interactionStart.y, dist);
                } else if (cfg.shape === 'square') {
                    this.previewGraphics.fillRect(this.interactionStart.x - dist, this.interactionStart.y - dist, dist * 2, dist * 2).strokeRect(this.interactionStart.x - dist, this.interactionStart.y - dist, dist * 2, dist * 2);
                } else if (cfg.shape === 'cone') {
                    const angle = Phaser.Math.Angle.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y);
                    const spread = Math.PI / 6;
                    const p2x = this.interactionStart.x + Math.cos(angle - spread) * dist;
                    const p2y = this.interactionStart.y + Math.sin(angle - spread) * dist;
                    const p3x = this.interactionStart.x + Math.cos(angle + spread) * dist;
                    const p3y = this.interactionStart.y + Math.sin(angle + spread) * dist;
                    this.previewGraphics.fillTriangle(this.interactionStart.x, this.interactionStart.y, p2x, p2y, p3x, p3y).strokeTriangle(this.interactionStart.x, this.interactionStart.y, p2x, p2y, p3x, p3y);
                }
            }
        });

        this.input.on('pointerup', (pointer) => {
            if (this.isDrawing) {
                const pMundo = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                const dist = Phaser.Math.Distance.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y);

                if (this.ferramentaAtual === 'aoe') {
                    const cfg = window.toolConfig;
                    const obj = this.add.graphics();
                    obj.fillStyle(cfg.color, 0.3).lineStyle(2, cfg.color, 0.8);
                    
                    let hitbox;

                    if (cfg.shape === 'circle') {
                        hitbox = new Phaser.Geom.Circle(this.interactionStart.x, this.interactionStart.y, dist);
                        obj.fillCircleShape(hitbox).strokeCircleShape(hitbox);
                        obj.setInteractive(hitbox, Phaser.Geom.Circle.Contains);
                        obj.drawingMeta = { type: 'aoe', shape: 'circle', color: cfg.color, x: this.interactionStart.x, y: this.interactionStart.y, radius: dist };
                    } else if (cfg.shape === 'square') {
                        hitbox = new Phaser.Geom.Rectangle(this.interactionStart.x - dist, this.interactionStart.y - dist, dist * 2, dist * 2);
                        obj.fillRectShape(hitbox).strokeRectShape(hitbox);
                        obj.setInteractive(hitbox, Phaser.Geom.Rectangle.Contains);
                        obj.drawingMeta = { type: 'aoe', shape: 'square', color: cfg.color, x: this.interactionStart.x - dist, y: this.interactionStart.y - dist, width: dist * 2, height: dist * 2 };
                    } else if (cfg.shape === 'cone') {
                        const angle = Phaser.Math.Angle.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y);
                        const spread = Math.PI / 6;
                        hitbox = new Phaser.Geom.Triangle(
                            this.interactionStart.x, this.interactionStart.y,
                            this.interactionStart.x + Math.cos(angle - spread) * dist, this.interactionStart.y + Math.sin(angle - spread) * dist,
                            this.interactionStart.x + Math.cos(angle + spread) * dist, this.interactionStart.y + Math.sin(angle + spread) * dist
                        );
                        obj.fillTriangleShape(hitbox).strokeTriangleShape(hitbox);
                        obj.setInteractive(hitbox, Phaser.Geom.Triangle.Contains);
                        obj.drawingMeta = { type: 'aoe', shape: 'cone', color: cfg.color, points: [{ x: hitbox.x1, y: hitbox.y1 }, { x: hitbox.x2, y: hitbox.y2 }, { x: hitbox.x3, y: hitbox.y3 }] };
                    }

                    obj.on('pointerdown', () => { if(this.ferramentaAtual === 'eraser') obj.destroy(); });
                    this.camadaTatico.add(obj);
                    this.recordDrawing(obj);

                } else if (this.ferramentaAtual === 'draw') {
                    this.currentDrawingPath.setInteractive(this.currentDrawingPath.getBounds(), Phaser.Geom.Rectangle.Contains);
                    const path = this.currentDrawingPath;
                    path.on('pointerdown', () => { if(this.ferramentaAtual === 'eraser') path.destroy(); });
                    this.recordDrawing(path);
                }
            }
            this.previewGraphics.clear();
            this.isDrawing = false;
            this.isMeasuring = false;
        });
        
       // Adiciona evento global de duplo clique para Tokens abrirem a Ficha
        this.input.on('gameobjectdown', (pointer, gameObject) => {
            if (this.ferramentaAtual !== 'select') return;
            if (gameObject.texture && gameObject.texture.key.startsWith('tk_')) {
                window.selectedToken = gameObject;
                if (typeof window.showTokenQuickBar === 'function') window.showTokenQuickBar(gameObject);
            }
            
            const timeNow = pointer.time;
            if (gameObject.lastClickTime && timeNow - gameObject.lastClickTime < 300) {
                if (gameObject.texture && gameObject.texture.key.startsWith('tk_')) {
                    const charName = gameObject.charName || gameObject.texture.key.replace('tk_', '').split('_')[0];
                    if(window.abrirFicha) window.abrirFicha(charName, gameObject.tokenId);
                }
            }
            gameObject.lastClickTime = timeNow;
        });

        // --- SISTEMA DE ZOOM INFINITO ---
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            let zoomFactor = deltaY > 0 ? 0.85 : 1.15; 
            let newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomFactor, 0.02, 10);
            this.cameras.main.setZoom(newZoom);
        });

        window.phaserScene = this;
        this.refreshLibrary();
    }

    getMaxFogTextureSize() {
        const gl = this.game?.renderer?.gl;
        const gpuLimit = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 8192;
        return Math.max(2048, Math.min(gpuLimit || 8192, 8192));
    }

    createFogRenderTexture(x, y, width, height) {
        const alpha = this.fogRT ? this.fogRT.alpha : 0.9;
        if (this.fogRT) {
            this.camadaFog.remove(this.fogRT, true);
        }

        this.fogRT = this.add.renderTexture(x, y, width, height).setOrigin(0).setAlpha(alpha);
        this.camadaFog.add(this.fogRT);
        return this.fogRT;
    }

    createFogSnapshot() {
        if (!this.fogRT?.texture) return null;

        const texture = this.fogRT.texture;
        const width = Math.floor(texture.width || this.fogRT.width || 0);
        const height = Math.floor(texture.height || this.fogRT.height || 0);

        if (width <= 0 || height <= 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) return null;

        if (texture.drawingContext?.framebuffer && this.game?.renderer?.gl) {
            const renderer = this.game.renderer;
            const gl = renderer.gl;
            const framebuffer = texture.drawingContext.framebuffer;
            const previousFramebuffer = renderer.glWrapper.state.bindings.framebuffer;

            renderer.glWrapper.updateBindingsFramebuffer({ bindings: { framebuffer } });

            const pixels = new Uint8Array(width * height * 4);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;

            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const sourceIndex = ((height - py - 1) * width + px) * 4;
                    const destIndex = (py * width + px) * 4;

                    data[destIndex] = pixels[sourceIndex];
                    data[destIndex + 1] = pixels[sourceIndex + 1];
                    data[destIndex + 2] = pixels[sourceIndex + 2];
                    data[destIndex + 3] = pixels[sourceIndex + 3];
                }
            }

            ctx.putImageData(imageData, 0, 0);
            renderer.glWrapper.updateBindingsFramebuffer({ bindings: { framebuffer: previousFramebuffer } });
        } else if (texture.canvas) {
            ctx.drawImage(texture.canvas, 0, 0);
        } else {
            return null;
        }

        return {
            format: 'renderTexturePng',
            dataUrl: canvas.toDataURL('image/png'),
            x: this.fogRT.x,
            y: this.fogRT.y,
            width,
            height,
            covered: !!this.isFogCovered
        };
    }

    restoreFogState(state) {
        const fogState = state?.fog || {};
        const alpha = fogState.alpha ?? state?.fogOpacity ?? 0.9;
        const mode = fogState.mode || 'reveal';
        const snapshot = fogState.snapshot || null;

        if (window.toolConfig) {
            window.toolConfig.fogMode = mode;
        }

        if (!this.fogRT) return;

        if (!snapshot?.dataUrl) {
            this.fogRT.setAlpha(alpha);
            this.fogRT.clear();
            this.isFogCovered = false;
            return;
        }

        const width = Math.floor(snapshot.width || 0);
        const height = Math.floor(snapshot.height || 0);

        if (width <= 0 || height <= 0) {
            this.fogRT.setAlpha(alpha);
            this.isFogCovered = !!snapshot.covered;
            return;
        }

        const x = Number.isFinite(snapshot.x) ? snapshot.x : this.fogRT.x;
        const y = Number.isFinite(snapshot.y) ? snapshot.y : this.fogRT.y;
        const key = `fog_snapshot_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        this.createFogRenderTexture(x, y, width, height);
        this.fogRT.setAlpha(alpha);
        this.fogRT.clear();
        this.isFogCovered = !!snapshot.covered;

        const drawSnapshot = () => {
            if (!this.textures.exists(key) || !this.fogRT) return;

            this.fogRT.clear();
            this.fogRT.draw(key, width / 2, height / 2);
            this.fogRT.setAlpha(alpha);
            this.textures.remove(key);
        };
        const handleSnapshotLoad = (loadedKey) => {
            if (loadedKey !== key) return;
            this.textures.off('onload', handleSnapshotLoad);
            this.textures.off('onerror', handleSnapshotError);
            drawSnapshot();
        };
        const handleSnapshotError = (loadedKey) => {
            if (loadedKey !== key) return;
            this.textures.off('onload', handleSnapshotLoad);
            this.textures.off('onerror', handleSnapshotError);
            if (this.fogRT) this.fogRT.setAlpha(alpha);
        };

        this.textures.on('onload', handleSnapshotLoad);
        this.textures.on('onerror', handleSnapshotError);
        this.textures.addBase64(key, snapshot.dataUrl);
    }

    getFogBounds() {
        const padding = 1024;
        const maxSize = this.getMaxFogTextureSize();
        const maps = Array.isArray(this.mapasAtivos) ? this.mapasAtivos.filter(m => m?.getBounds) : [];

        if (!maps.length) {
            const view = this.cameras.main.worldView;
            return {
                x: view.centerX - maxSize / 2,
                y: view.centerY - maxSize / 2,
                width: maxSize,
                height: maxSize
            };
        }

        const union = maps.reduce((bounds, map) => {
            const rect = map.getBounds();
            return bounds ? Phaser.Geom.Rectangle.Union(bounds, rect) : rect;
        }, null);
        const width = Math.min(maxSize, Math.max(2048, Math.ceil(union.width + padding * 2)));
        const height = Math.min(maxSize, Math.max(2048, Math.ceil(union.height + padding * 2)));

        return {
            x: Math.floor(union.centerX - width / 2),
            y: Math.floor(union.centerY - height / 2),
            width,
            height
        };
    }

    resetFogArea(covered = this.isFogCovered) {
        const bounds = this.getFogBounds();
        this.createFogRenderTexture(bounds.x, bounds.y, bounds.width, bounds.height);
        this.fogRT.clear();

        if (covered) {
            this.fogRT.fill(0x000000, 1);
        }

        this.isFogCovered = !!covered;
    }

    getFogLocalPoint(worldPoint) {
        return {
            x: worldPoint.x - this.fogRT.x,
            y: worldPoint.y - this.fogRT.y
        };
    }

    applyFogAt(worldPoint) {
        if (!this.fogRT) return;

        const localPoint = this.getFogLocalPoint(worldPoint);
        const mode = window.toolConfig?.fogMode || 'reveal';

        if (mode === 'reveal') {
            this.fogRT.erase(this.fogBrush, localPoint.x, localPoint.y);
        } else {
            this.fogRT.draw(this.fogBrushDark, localPoint.x, localPoint.y);
            this.isFogCovered = true;
        }
    }

    mudarFerramenta(nome) {
        this.ferramentaAtual = nome;
        const isPlayerViewMode = isPlayerViewModeVtt();
        
        if (nome !== 'ruler') {
            this.graficosRegua.clear();
            this.textoRegua.setVisible(false);
        }
        
        // Trava ou Destrava Tokens
        this.camadaTokens.list.forEach(token => {
            this.input.setDraggable(token, !isPlayerViewMode && nome === 'select');
        });

        // Trava ou Destrava Mapas para montagem
        if (this.mapasAtivos) {
            this.mapasAtivos.forEach(mapa => {
                this.input.setDraggable(mapa, !isPlayerViewMode && nome === 'map-edit');
            });
        }
    }

   limparDesenho() {
        this.camadaTatico.removeAll(true);
        this.previewGraphics.clear();
        this.drawingHistory = [];
        this.redoHistory = [];
    }

    // --- CONTROLES DA NEBLINA ---
    coverFog() {
        this.resetFogArea(true);
    }

    getSceneSettings() {
        this.sceneSettings = {
            gridEnabled: true,
            gridSize: PIXELS_POR_UNIDADE,
            snapToGrid: true,
            distancePerCell: METROS_POR_QUADRADO,
            distanceUnit: 'm',
            ...(window.sceneSettings || {}),
            ...(this.sceneSettings || {})
        };
        window.sceneSettings = this.sceneSettings;
        return this.sceneSettings;
    }

    getSceneGridSize() {
        return Number(this.getSceneSettings().gridSize) || PIXELS_POR_UNIDADE;
    }

    applySceneSettings(settings = {}) {
        const normalized = {
            ...settings,
            gridSize: settings.gridSize || settings.size || this.getSceneSettings().gridSize,
            gridEnabled: settings.gridEnabled ?? settings.visible ?? this.getSceneSettings().gridEnabled,
            distancePerCell: settings.distancePerCell || settings.metersPerSquare || this.getSceneSettings().distancePerCell
        };
        this.sceneSettings = { ...this.getSceneSettings(), ...normalized };
        window.sceneSettings = this.sceneSettings;

        if (this.grid) this.grid.destroy();
        if (this.sceneSettings.gridEnabled !== false) {
            const gridSize = this.getSceneGridSize();
            this.grid = this.add.grid(0, 0, 30000, 30000, gridSize, gridSize, 0, 0, 0x888888, 0.3);
            this.camadaGrid.add(this.grid);
        } else {
            this.grid = null;
        }
        if (typeof window.syncSceneSettingsControls === 'function') window.syncSceneSettingsControls();
    }

    toggleGrid() {
        this.applySceneSettings({ gridEnabled: this.getSceneSettings().gridEnabled === false });
    }

    setGridSize(size) {
        const gridSize = Math.max(20, parseInt(size, 10) || PIXELS_POR_UNIDADE);
        this.applySceneSettings({ gridSize });
    }

    toggleSnapToGrid() {
        this.sceneSettings = { ...this.getSceneSettings(), snapToGrid: !this.getSceneSettings().snapToGrid };
        window.sceneSettings = this.sceneSettings;
    }

    snapTokenToGrid(token) {
        if (!token || this.getSceneSettings().snapToGrid === false) return;
        const gridSize = this.getSceneGridSize();
        const offset = (token.gridSize % 2 === 0) ? 0 : (gridSize / 2);
        token.x = Math.round(token.x / gridSize) * gridSize + offset;
        token.y = Math.round(token.y / gridSize) * gridSize + offset;
    }

    saveSceneGridSettings() {
        window.sceneSettings = { ...this.getSceneSettings() };
        return window.sceneSettings;
    }

    loadSceneGridSettings(settings) {
        this.applySceneSettings(settings || {});
    }
    
    clearFog() {
        if (this.fogRT) this.fogRT.clear();
        this.isFogCovered = false;
    }

// --- CONTROLES DE CLIMA DINÂMICO ---
    setAdvancedWeather(config) {
        this.currentWeather = {
            ash: Number(config?.ash) || 0,
            rain: Number(config?.rain) || 0,
            sun: Number(config?.sun) || 0,
            wind: Number(config?.wind) || 0
        };
        config = this.currentWeather;

        if (config.ash > 0) {
            this.ashEmitter.setConfig({ 
                x: { min: -5000, max: 10000 }, y: -1000, lifespan: 12000, 
                speedY: { min: 50 + config.ash, max: 100 + config.ash }, 
                speedX: { min: -100, max: 100 }, scale: { start: 0.3, end: 1.2 }, 
                quantity: Math.floor(config.ash / 5), alpha: {start: 0.8, end: 0} 
            });
            this.ashEmitter.start();
        } else { this.ashEmitter.stop(); }

        if (config.rain > 0) {
            this.rainEmitter.setConfig({ 
                x: { min: -5000, max: 10000 }, y: -1000, lifespan: 3000, 
                speedY: { min: 800 + (config.rain * 5), max: 1200 + (config.rain * 5) }, 
                speedX: { min: 100 + config.rain, max: 300 + config.rain }, scale: { start: 0.6, end: 1.5 }, 
                quantity: Math.floor(config.rain / 2), alpha: 0.5 
            });
            this.rainEmitter.start();
        } else { this.rainEmitter.stop(); }

        this.sunOverlay.setAlpha(config.sun / 200);
        if (!isPlayerViewModeVtt() && typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
    }

    // --- SISTEMA DE TABULEIRO (SAVE/LOAD) ---
    getBoardState() {
        const camera = this.cameras.main;
        const notesState = typeof window.getSceneAwareNotesState === 'function'
            ? window.getSceneAwareNotesState()
            : { pinnedNotes: window.pinnedNotes || [], revealedNotes: [] };
        const state = {
            version: 2,
            sceneName: window.currentSceneName || window.directedSceneDraft?.sceneName || '',
            sceneId: window.currentSceneId || notesState.sceneId || '',
            camera: {
                x: camera.scrollX,
                y: camera.scrollY,
                zoom: camera.zoom
            },
            grid: {
                visible: this.grid ? this.grid.visible : true,
                size: this.getSceneGridSize(),
                metersPerSquare: this.getSceneSettings().distancePerCell
            },
            sceneSettings: this.saveSceneGridSettings(),
            combatState: {
                ...(window.combatState || { active: false, round: 1, currentTurnIndex: 0, participants: [] }),
                participants: (window.combatState?.participants || []).map(({ tokenRef, ...participant }) => participant)
            },
            sessionState: typeof window.getSessionStateSnapshot === 'function'
                ? window.getSessionStateSnapshot()
                : (window.sessionState || {
                    active: false,
                    sessionName: '',
                    startedAt: null,
                    endedAt: null,
                    events: []
                }),
            weather: this.currentWeather || null,
            fog: {
                alpha: this.fogRT ? this.fogRT.alpha : 0.9,
                mode: window.toolConfig ? window.toolConfig.fogMode : 'reveal',
                snapshot: this.createFogSnapshot()
            },
            fogOpacity: this.fogRT ? this.fogRT.alpha : 0.9,
            mapas: [],
            maps: [],
            tokens: [],
            drawings: [],
            initiative: window.initiativeList || [],
            round: window.currentRound || 1,
            audio: {
                currentTrack: window.currentAudioTrack || null,
                volume: document.getElementById('audio-volume') ? parseFloat(document.getElementById('audio-volume').value) : 0.5
            },
            pinnedNotes: notesState.pinnedNotes || [],
            revealedNotes: notesState.revealedNotes || [],
            sceneNotes: notesState.sceneNotes || [
                ...(notesState.pinnedNotes || []),
                ...(notesState.revealedNotes || []).filter(note => !(notesState.pinnedNotes || []).some(pinned => pinned.id === note.id))
            ],
            revealedHandouts: window.revealedHandouts || [],
            sceneDirector: window.directedSceneDraft || null
        };
        if (this.mapasAtivos) {
            this.mapasAtivos.forEach(m => {
                const mapState = {
                    key: m.texture.key.split('_').slice(0, -1).join('_'),
                    path: m.caminhoAbsoluto,
                    x: m.x,
                    y: m.y,
                    scaleX: m.scaleX,
                    scaleY: m.scaleY,
                    width: m.displayWidth,
                    height: m.displayHeight,
                    locked: this.mapLocked
                };
                state.mapas.push(mapState);
                state.maps.push(mapState);
            });
        }
        if (this.camadaTokens.list) {
            this.camadaTokens.list.forEach(t => {
                const ficha = (window.fichasSalvas && t.tokenId) ? window.fichasSalvas[t.tokenId] : null;
                state.tokens.push({
                    key: t.texture.key,
                    textureKey: t.texture.key,
                    path: t.caminhoAbsoluto,
                    x: t.x,
                    y: t.y,
                    scaleX: t.scaleX,
                    scaleY: t.scaleY,
                    gridSize: t.gridSize || 1,
                    elev: t.elevText ? t.elevText.text : '',
                    elevation: t.elevText ? t.elevText.text : '',
                    tokenId: t.tokenId,
                    aura: t.auraColor || null,
                    auraEmoji: t.statusText ? t.statusText.text : null,
                    status: t.statusText ? t.statusText.text : null,
                    charName: t.charName,
                    hp: ficha ? ficha.hpAtual : t.hpAtual,
                    hpMax: ficha ? ficha.hpMax : t.hpMax,
                    visibleToPlayers: t.visibleToPlayers !== false && ficha?.isVisibleToPlayers !== false,
                    locked: !!t.locked,
                    notes: t.notes || '',
                    conditions: Array.isArray(t.conditions) ? [...t.conditions] : []
                });
            });
        }
        if (this.camadaTatico && this.camadaTatico.list) {
            state.drawings = this.camadaTatico.list
                .filter(obj => obj.drawingMeta && obj.visible !== false && obj.active !== false)
                .map(obj => obj.drawingMeta);
        }
        return state;
    }

    loadBoardState(state) {
        if (!state) return;
        state = typeof window.normalizeBoardState === 'function'
            ? window.normalizeBoardState(state)
            : state;
        state.mapas = state.mapas || state.maps || [];
        state.tokens = state.tokens || [];
        if (isPlayerViewModeVtt()) {
            state.tokens = state.tokens.filter(token => token.visibleToPlayers !== false);
            state.drawings = (state.drawings || []).filter(drawing => drawing.visibleToPlayers !== false);
            const visibleTokenIds = new Set(state.tokens.map(token => token.tokenId || token.characterId || token.id).filter(Boolean));
            if (state.combatState?.participants) {
                state.combatState = {
                    ...state.combatState,
                    participants: state.combatState.participants.filter(participant => !participant?.id || visibleTokenIds.has(participant.id))
                };
            }
        }
        this.loadSceneGridSettings(state.sceneSettings || state.grid || {});
        this.camadaMapa.removeAll(true);
        this.clearTokenLayerVtt();
        this.camadaTatico.removeAll(true);
        this.drawingHistory = [];
        this.redoHistory = [];
        this.mapasAtivos = [];
        if (state.camera) {
            this.cameras.main.setScroll(state.camera.x || 0, state.camera.y || 0);
            this.cameras.main.setZoom(state.camera.zoom || 1);
        }
        if (this.grid && state.grid) {
            this.grid.setVisible(state.grid.visible !== false);
        }
        if (this.fogRT) {
            this.fogRT.setAlpha(state.fog?.alpha ?? state.fogOpacity ?? 0.9);
            if (window.toolConfig && state.fog?.mode) window.toolConfig.fogMode = state.fog.mode;
        }
        if (state.weather && this.setAdvancedWeather) {
            this.setAdvancedWeather(state.weather);
        }
        if (Array.isArray(state.initiative)) {
            window.initiativeList = state.initiative;
            if (typeof initiativeList !== 'undefined') initiativeList = state.initiative;
            if (typeof renderInitiative === 'function') renderInitiative();
        }
        if (state.round) {
            window.currentRound = state.round;
            if (typeof currentRound !== 'undefined') currentRound = state.round;
            const roundCounter = document.getElementById('round-counter');
            if (roundCounter) roundCounter.textContent = `Round: ${state.round}`;
        }
        if (state.sceneDirector && typeof restoreDirectedSceneFromState === 'function') {
            restoreDirectedSceneFromState(state.sceneDirector);
        } else if (state.sceneDirector) {
            window.directedSceneDraft = state.sceneDirector;
        }
        if (state.sessionState) {
            if (typeof window.restoreSessionState === 'function') {
                window.restoreSessionState(state.sessionState);
            } else {
                window.sessionState = state.sessionState;
                if (typeof window.renderSessionTimeline === 'function') {
                    window.renderSessionTimeline();
                }
                if (typeof window.persistSessionState === 'function') {
                    window.persistSessionState();
                }
            }
        }
        if (!window.location.search.includes('player=true') && typeof restoreSceneNotesFromBoardState === 'function') {
            restoreSceneNotesFromBoardState(state);
        } else {
            window.currentSceneName = state.sceneName || state.sceneDirector?.sceneName || '';
            window.currentSceneId = state.sceneId || '';
            window.pinnedNotes = Array.isArray(state.pinnedNotes) ? state.pinnedNotes : [];
        }
        if (Array.isArray(state.revealedHandouts)) {
            window.revealedHandouts = state.revealedHandouts;
        }
        if (Array.isArray(state.drawings)) {
            state.drawings.forEach(d => this.restoreDrawing(d));
        }
        
        const restoreFogAfterAssets = () => this.restoreFogState(state);

        state.mapas.forEach(m => {
            const ext = m.path.split('.').pop().toLowerCase();
            const isVideo = ['webm', 'mp4'].includes(ext);
            
            if (isVideo) this.load.video(m.key, `file://${m.path}`);
            else this.load.image(m.key, `file://${m.path}`);
            
            this.load.once('complete', () => {
                let novoMapa;
                if (isVideo) {
                    novoMapa = this.add.video(m.x, m.y, m.key).setInteractive();
                    novoMapa.play(true);
                } else {
                    novoMapa = this.add.image(m.x, m.y, m.key).setInteractive();
                }
                
                novoMapa.caminhoAbsoluto = m.path;
                this.input.setDraggable(novoMapa, !isPlayerViewModeVtt() && this.ferramentaAtual === 'map-edit');
                novoMapa.on('drag', (p, dx, dy) => { if(!isPlayerViewModeVtt() && this.ferramentaAtual==='map-edit'){ novoMapa.x=dx; novoMapa.y=dy;} });
                novoMapa.on('dragend', () => {
                    if (isPlayerViewModeVtt()) return;
                    const gridSize = this.getSceneGridSize();
                    novoMapa.x = Math.round(novoMapa.x / gridSize) * gridSize;
                    novoMapa.y = Math.round(novoMapa.y / gridSize) * gridSize;
                    if (typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
                });
                if (m.scaleX) novoMapa.setScale(m.scaleX, m.scaleY || m.scaleX);
                this.mapasAtivos.push(novoMapa);
                this.camadaMapa.add(novoMapa);
                this.resetFogArea(this.isFogCovered);
            });
        });
        if (state.mapas.length > 0) {
            this.load.once('complete', restoreFogAfterAssets);
        } else {
            restoreFogAfterAssets();
        }
        this.load.start();

        const pendingTokenSpawns = state.tokens.map(t => new Promise(resolve => {
            const key = t.key || t.textureKey;
            const ext = t.path.split('.').pop().toLowerCase();
            const isVideo = ['webm', 'mp4'].includes(ext);
            
           if (!this.textures.exists(key) && !this.cache.video.has(key)) {
                if (isVideo) this.load.video(key, `file://${t.path}`);
                else this.load.image(key, `file://${t.path}`);
                
                this.load.once('complete', () => {
                    this.spawnTokenAt(key, t.path, t.x, t.y, t.elev || t.elevation, t.tokenId, isVideo, t.charName, t);
                    resolve();
                });
            } else {
                this.spawnTokenAt(key, t.path, t.x, t.y, t.elev || t.elevation, t.tokenId, isVideo, t.charName, t);
                resolve();
            }
        }));
        this.load.start();
        Promise.all(pendingTokenSpawns).then(() => {
            if (typeof window.restoreCombatAfterTokensLoaded === 'function') window.restoreCombatAfterTokensLoaded(state.combatState);
            else if (typeof window.restoreCombatState === 'function') window.restoreCombatState(state.combatState);
        });
    }

    recordDrawing(obj) {
        if (!obj) return;
        this.drawingHistory.push(obj);
        this.redoHistory = [];
    }

    restoreDrawing(meta) {
        if (!meta) return null;

        const obj = this.add.graphics();
        const color = meta.color || 0xfbbf24;
        obj.fillStyle(color, 0.3).lineStyle(meta.thickness || 2, color, 0.8);
        obj.drawingMeta = meta;

        if (meta.type === 'freehand' && Array.isArray(meta.points) && meta.points.length > 0) {
            obj.lineStyle(meta.thickness || 2, color, 1);
            obj.beginPath();
            obj.moveTo(meta.points[0].x, meta.points[0].y);
            meta.points.slice(1).forEach(point => obj.lineTo(point.x, point.y));
            obj.strokePath();
            obj.setInteractive(obj.getBounds(), Phaser.Geom.Rectangle.Contains);
        } else if (meta.shape === 'circle') {
            const hitbox = new Phaser.Geom.Circle(meta.x, meta.y, meta.radius || 0);
            obj.fillCircleShape(hitbox).strokeCircleShape(hitbox);
            obj.setInteractive(hitbox, Phaser.Geom.Circle.Contains);
        } else if (meta.shape === 'square') {
            const hitbox = new Phaser.Geom.Rectangle(meta.x, meta.y, meta.width || 0, meta.height || 0);
            obj.fillRectShape(hitbox).strokeRectShape(hitbox);
            obj.setInteractive(hitbox, Phaser.Geom.Rectangle.Contains);
        } else if (meta.shape === 'cone' && Array.isArray(meta.points) && meta.points.length === 3) {
            const hitbox = new Phaser.Geom.Triangle(
                meta.points[0].x, meta.points[0].y,
                meta.points[1].x, meta.points[1].y,
                meta.points[2].x, meta.points[2].y
            );
            obj.fillTriangleShape(hitbox).strokeTriangleShape(hitbox);
            obj.setInteractive(hitbox, Phaser.Geom.Triangle.Contains);
        } else {
            obj.destroy();
            return null;
        }

        obj.on('pointerdown', () => { if (this.ferramentaAtual === 'eraser') obj.destroy(); });
        this.camadaTatico.add(obj);
        this.drawingHistory.push(obj);
        return obj;
    }

    async refreshLibrary() {
        const maps = await window.api.getMaps();
        const tokens = await window.api.getTokens();
        const audios = await window.api.getAudio();

        // Puxa as fichas do banco ANTES de desenhar a interface
        if (window.api && window.api.getCharacters) {
            const dadosBrutos = await window.api.getCharacters();
            if (typeof window.fichasSalvas === 'undefined' && typeof fichasSalvas === 'undefined') {
                window.fichasSalvas = {};
            }
            const fichaRef = typeof fichasSalvas !== 'undefined' ? fichasSalvas : window.fichasSalvas;

            for (let id in dadosBrutos) {
                try {
                    fichaRef[id] = typeof dadosBrutos[id] === 'string' ? JSON.parse(dadosBrutos[id]) : dadosBrutos[id];
                } catch (e) { }
            }
        }

        const mapList = document.getElementById('map-list');
        const tokenList = document.getElementById('token-list');
        const audioList = document.getElementById('audio-list');
        const imgList = document.getElementById('images-list');
        const videoList = document.getElementById('videos-list');

        const agruparPorCategoria = (itens) => {
            return (itens || []).reduce((acc, item) => {
                const categoria = item.category || 'Raiz';
                (acc[categoria] = acc[categoria] || []).push(item);
                return acc;
            }, {});
        };

        const ordenarPorNome = (itens) => {
            return [...(itens || [])].sort((a, b) => {
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        };

        // Renderizar Vídeos Dinâmicos com preview + nome exato do arquivo
        if (videoList && window.api.getVideos) {
            const videos = ordenarPorNome(await window.api.getVideos());
            const videosByCat = agruparPorCategoria(videos);

            videoList.innerHTML = `
                ${renderVttLibraryOverview({
                    icon: 'fa-solid fa-film',
                    title: 'Cenas e videos',
                    subtitle: 'Cinematicas, loops e referencias visuais',
                    count: videos.length
                })}
                ${renderVttGroupedLibrary(videosByCat, v => {
                        const path = normalizarCaminhoVtt(v.path);
                        const fileName = nomeArquivoVtt(v, 'video-sem-nome');
                        const title = limparExtensaoVtt(fileName);
                        const jsPath = escaparJsVtt(path);
                        const jsFileName = escaparJsVtt(fileName);

                        return renderVttLibraryCard({
                            icon: 'fa-solid fa-film',
                            title,
                            fileName,
                            subtitle: 'Vídeo / Cena cinematográfica',
                            meta: 'Clique para pré-visualizar',
                            path,
                            preview: path,
                            previewType: 'video',
                            variant: 'video',
                            onClick: `mostrarVideo('${jsPath}')`,
                            actions: `
                                <button class="ui-icon-btn" type="button" onclick="showHandoutPathToPlayers('${jsPath}', 'video', '${jsFileName}')" data-vtt-tooltip="Mostrar aos jogadores">
                                    <i class="fas fa-users"></i>
                                </button>
                            `
                        });
                    }, 'Nenhum video cadastrado.')}
            `;
        }

        // Renderizar Imagens Dinâmicas com preview + nome exato do arquivo
        if (imgList && window.api.getImages) {
            const imagens = ordenarPorNome(await window.api.getImages());
            const imagensByCat = agruparPorCategoria(imagens);

            imgList.innerHTML = `
                ${renderVttLibraryOverview({
                    icon: 'fa-solid fa-image',
                    title: 'Handouts visuais',
                    subtitle: 'Pistas, retratos, props e imagens para revelar',
                    count: imagens.length
                })}
                ${renderVttGroupedLibrary(imagensByCat, i => {
                        const path = normalizarCaminhoVtt(i.path);
                        const fileName = nomeArquivoVtt(i, 'imagem-sem-nome');
                        const title = limparExtensaoVtt(fileName);
                        const jsPath = escaparJsVtt(path);
                        const jsFileName = escaparJsVtt(fileName);

                        return renderVttLibraryCard({
                            icon: 'fa-solid fa-image',
                            title,
                            fileName,
                            subtitle: 'Imagem / Handout',
                            meta: 'Material visual da campanha',
                            path,
                            preview: path,
                            previewType: 'image',
                            variant: 'image',
                            onClick: `mostrarImagem('${jsPath}')`,
                            actions: `
                                <button class="ui-icon-btn" type="button" onclick="showHandoutPathToPlayers('${jsPath}', 'image', '${jsFileName}')" data-vtt-tooltip="Mostrar aos jogadores">
                                    <i class="fas fa-users"></i>
                                </button>
                            `
                        });
                    }, 'Nenhuma imagem cadastrada.')}
            `;
        }

        // Renderizar Áudios Dinâmicos Agrupados por Pasta com nome exato do arquivo
        if (audioList && audios) {
            const audiosByCat = agruparPorCategoria(audios);

            audioList.innerHTML = `
                ${renderVttLibraryOverview({
                    icon: 'fa-solid fa-music',
                    title: 'Audio da mesa',
                    subtitle: 'Musicas, ambientes e efeitos por pasta',
                    count: audios.length
                })}
                ${renderVttGroupedLibrary(audiosByCat, (a, cat) => {
                            const path = normalizarCaminhoVtt(a.path);
                            const fileName = nomeArquivoVtt(a, 'audio-sem-nome');
                            const title = limparExtensaoVtt(fileName);
                            const jsPath = escaparJsVtt(path);
                            const jsFileName = escaparJsVtt(fileName);

                            return renderVttLibraryCard({
                                icon: 'fa-solid fa-music',
                                title,
                                fileName,
                                subtitle: 'Áudio / Ambiente',
                                meta: cat === 'Raiz' ? 'Arquivo de áudio da mesa' : `Pasta: ${cat}`,
                                path,
                                previewType: 'icon',
                                variant: 'audio',
                                onClick: `playMusic('${jsPath}', '${jsFileName}')`,
                                actions: `
                                    <button class="ui-icon-btn" type="button" onclick="playMusic('${jsPath}', '${jsFileName}')" data-vtt-tooltip="Tocar">
                                        <i class="fas fa-play"></i>
                                    </button>
                                    <button class="ui-icon-btn" type="button" onclick="if (typeof tocarJunto === 'function') { tocarJunto('${jsPath}', '${jsFileName}'); } else { playMusic('${jsPath}', '${jsFileName}'); }" data-vtt-tooltip="Tocar junto">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                `
                            });
                        }, 'Nenhum audio cadastrado.')}
            `;
        }

        const mapsByCat = agruparPorCategoria(maps);

        // 1. PRIMEIRO CARREGAMOS AS FICHAS (Correção do erro de variável!)
        const fichaRefLocal = typeof fichasSalvas !== 'undefined' ? fichasSalvas : (window.fichasSalvas || {});

        // 2. DEPOIS RENDERIZAMOS OS MAPAS com preview + nome exato do arquivo
        if (mapList) {
            mapList.innerHTML = `
                ${renderVttLibraryOverview({
                    icon: 'fa-solid fa-map-location-dot',
                    title: 'Mapas e cenarios',
                    subtitle: 'Cenarios estaticos e mapas animados agrupados por pasta',
                    count: maps.length
                })}
                ${renderVttGroupedLibrary(mapsByCat, (m, cat) => {
                            const path = normalizarCaminhoVtt(m.path);
                            const fileName = nomeArquivoVtt(m, 'mapa-sem-nome');
                            const title = limparExtensaoVtt(fileName);
                            const ext = path.split('.').pop().toLowerCase();
                            const isVideo = ['webm', 'mp4'].includes(ext);
                            const jsPath = escaparJsVtt(path);
                            const jsFileName = escaparJsVtt(fileName);

                            return renderVttLibraryCard({
                                icon: 'fa-solid fa-map-location-dot',
                                title,
                                fileName,
                                subtitle: isVideo ? 'Mapa animado / Vídeo' : 'Mapa / Cenário',
                                meta: cat === 'Raiz' ? 'Cenário da mesa' : `Pasta: ${cat}`,
                                path,
                                preview: path,
                                previewType: isVideo ? 'video' : 'image',
                                variant: 'map',
                                onClick: `phaserScene.carregarMapa('${jsPath}', '${jsFileName}')`
                            });
                        }, 'Nenhum mapa cadastrado.')}
            `;
        }

        // 3. Chama a função oficial do HTML para gerenciar a lista de atores/tokens,
        // garantindo que não tenha mais conflito de views.
        if (typeof window.renderizarListaTokens === 'function') {
            window.renderizarListaTokens();
        }

        // Reaplica tooltips customizados nos botões recriados dinamicamente, quando existir no app.js.
        if (typeof window.setupVttTooltips === 'function') {
            window.setupVttTooltips();
        }
    }



    carregarMapa(caminhoAbsoluto, nome) {
        const ext = caminhoAbsoluto.split('.').pop().toLowerCase();
        const isVideo = ['webm', 'mp4'].includes(ext);
        const key = `map_${nome}_${Date.now()}`; 
        
        if (isVideo) this.load.video(key, `file://${caminhoAbsoluto}`);
        else this.load.image(key, `file://${caminhoAbsoluto}`);
        
        this.load.once('complete', () => {
            if (!this.grid) {
                const gridSize = this.getSceneGridSize();
                this.grid = this.add.grid(0, 0, 30000, 30000, gridSize, gridSize, 0, 0, 0x888888, 0.3);
                this.camadaGrid.add(this.grid);
            }
            const mapView = this.cameras.main.worldView;
            
            let novoMapa;
            if (isVideo) {
                novoMapa = this.add.video(mapView.centerX, mapView.centerY, key).setInteractive();
                novoMapa.play(true); // O 'true' faz o vídeo rodar em loop infinito
            } else {
                novoMapa = this.add.image(mapView.centerX, mapView.centerY, key).setInteractive();
            }
            
            novoMapa.caminhoAbsoluto = caminhoAbsoluto;
            this.input.setDraggable(novoMapa, !isPlayerViewModeVtt() && this.ferramentaAtual === 'map-edit');
            novoMapa.on('drag', (pointer, dragX, dragY) => { if (isPlayerViewModeVtt() || this.ferramentaAtual !== 'map-edit') return; novoMapa.x = dragX; novoMapa.y = dragY; });
            novoMapa.on('dragend', () => {
                if (isPlayerViewModeVtt()) return;
                const gridSize = this.getSceneGridSize();
                novoMapa.x = Math.round(novoMapa.x / gridSize) * gridSize;
                novoMapa.y = Math.round(novoMapa.y / gridSize) * gridSize;
                if (typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
            });
            
            if (!this.mapasAtivos) this.mapasAtivos = [];
            this.mapasAtivos.push(novoMapa);
            this.camadaMapa.add(novoMapa);
            this.resetFogArea(this.isFogCovered);
        });
        this.load.start();
    }

   adicionarToken(nome, path, characterId = null) {
        const ext = path.split('.').pop().toLowerCase();
        const isVideo = ['webm', 'mp4'].includes(ext);
        
        // MÁGICA: Adicionamos o path (codificado) na chave do Phaser!
        // Assim, se você mudar a imagem do token, o Phaser sabe que é uma textura NOVA e não usa o cache antigo.
        const safePath = btoa(encodeURIComponent(path)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
        const key = `tk_${nome}_${safePath}`;
        
        if (!this.textures.exists(key) && !this.cache.video.has(key)) {
            if (isVideo) this.load.video(key, `file://${path}`);
            else this.load.image(key, `file://${path}`);
            
            this.load.once('complete', () => this.spawnTokenAt(key, path, this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, '', characterId, isVideo, nome));
            this.load.start();
        } else {
            this.spawnTokenAt(key, path, this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, '', characterId, isVideo, nome);
        }
    }

    handleAssetDropOnCanvas(payload, x, y) {
        const asset = window.assetsLibraryState?.assets?.find(item => item.id === payload?.assetId);
        if (!asset || asset.missing) return;

        if (asset.type === 'map') {
            this.carregarMapa(asset.path, asset.fileName || asset.name);
            return;
        }

        if (['token', 'image', 'handout', 'portrait'].includes(asset.type)) {
            this.spawnTokenAsset(asset, x, y);
        }
    }

    spawnTokenAsset(asset, x, y) {
        if (!asset?.path) return;
        const ext = asset.path.split('.').pop().toLowerCase();
        const isVideo = ['webm', 'mp4'].includes(ext);
        const safePath = btoa(encodeURIComponent(asset.path)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
        const safeName = String(asset.name || 'Asset').replace(/[^a-zA-Z0-9_-]/g, '_');
        const key = `asset_${safeName}_${safePath}`;

        if (!this.textures.exists(key) && !this.cache.video.has(key)) {
            if (isVideo) this.load.video(key, `file://${asset.path}`);
            else this.load.image(key, `file://${asset.path}`);
            this.load.once('complete', () => this.spawnTokenAt(key, asset.path, x, y, '', null, isVideo, asset.name));
            this.load.start();
            return;
        }

        this.spawnTokenAt(key, asset.path, x, y, '', null, isVideo, asset.name);
    }

    spawnTokenAt(key, path, x, y, elev, savedTokenId, isVideo = false, charName = null, savedState = null) {
        if (isVideo === false && path) {
            const ext = path.split('.').pop().toLowerCase();
            isVideo = ['webm', 'mp4'].includes(ext);
        }

        const targetTokenId = savedTokenId || savedState?.tokenId || savedState?.characterId || savedState?.id;
        if (isPlayerViewModeVtt() && savedState && !isTokenVisibleToPlayersVtt({ ...savedState, tokenId: targetTokenId })) {
            return null;
        }

        let token;
        if (isVideo) {
            token = this.add.video(x, y, key).setInteractive();
            token.play(true);
        } else {
            token = this.add.sprite(x, y, key).setInteractive();
        }
        
        token.caminhoAbsoluto = path;
        // Salva o nome real do personagem no próprio Token para não dependermos da chave do cache:
        token.charName = charName || key.replace('tk_', '').split('_')[0];
        token.tokenId = targetTokenId || ('tk_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        token.characterId = token.tokenId;
        const linkedFicha = window.fichasSalvas?.[token.tokenId] || null;

        this.input.setDraggable(token, !isPlayerViewModeVtt() && this.ferramentaAtual === 'select');
        token.gridSize = savedState?.gridSize || 1;
        token.displayWidth = this.getSceneGridSize() * token.gridSize; 
        token.scaleY = token.scaleX;
        if (savedState?.scaleX) {
            token.setScale(savedState.scaleX, savedState.scaleY || savedState.scaleX);
        }
        token.visibleToPlayers = savedState?.visibleToPlayers !== false && linkedFicha?.isVisibleToPlayers !== false;
        token.locked = !!savedState?.locked;
        token.notes = savedState?.notes || '';
        token.conditions = Array.isArray(linkedFicha?.conditions)
            ? linkedFicha.conditions.map(condition => condition?.name || condition).filter(Boolean)
            : (Array.isArray(savedState?.conditions) ? [...savedState.conditions] : []);
        token.hpAtual = linkedFicha ? linkedFicha.hpAtual : savedState?.hp;
        token.hpMax = linkedFicha ? linkedFicha.hpMax : savedState?.hpMax;
        
        // EFEITO DE RESPIRAÇÃO (PHASER TWEENS)
        // Só aplica se for PNG/JPG estático. Faz o token "respirar" distorcendo 3% a escala.
        if (!isVideo) {
            token.baseScale = token.scaleX;
            token.breathTween = this.tweens.add({
                targets: token,
                scaleX: token.baseScale * 1.03, 
                scaleY: token.baseScale * 0.97, 
                duration: 1500 + Math.random() * 500, // Aleatório para os tokens não respirarem em coro
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        token.auraGraphics = this.add.graphics();
        token.hpGraphics = this.add.graphics();
        token.elevText = this.add.text(x, y - (PIXELS_POR_UNIDADE/2) - 10, elev || '', { font: 'bold 16px Arial', fill: '#fbbf24', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1);
        
        this.camadaMapa.add(token.auraGraphics);
        this.camadaTokens.add(token);
        this.camadaUI.add(token.hpGraphics);
        this.camadaUI.add(token.elevText);

        const syncExtras = () => { 
            token.auraGraphics.setPosition(token.x, token.y); 
            token.hpGraphics.setPosition(token.x, token.y);
            let offsetElev = (PIXELS_POR_UNIDADE/2) * token.gridSize;
            token.elevText.setPosition(token.x, token.y - offsetElev - 10); 
            if (token.statusText) token.statusText.setPosition(token.x + 20, token.y - 20);
            if (token.conditionGroup) token.conditionGroup.setPosition(token.x, token.y);
            const currentCombatant = window.combatState?.participants?.[window.combatState.currentTurnIndex];
            if (this.currentTurnMarker && currentCombatant?.id === token.tokenId) {
                this.currentTurnMarker.setPosition(token.x, token.y);
            }
            if (window.selectedToken === token && typeof window.positionTokenQuickBar === 'function') {
                window.positionTokenQuickBar(token);
            }
        };
        syncExtras();
        if (savedState?.aura) {
            this.setTokenAura(token, savedState.aura, savedState.auraEmoji || savedState.status);
        }
        if (token.hpAtual !== undefined && token.hpMax !== undefined) {
            this.updateTokenHP(token.tokenId, token.hpAtual, token.hpMax);
        }
        this.renderTokenConditions(token);

        token.on('pointerdown', (pointer) => {
            if (isPlayerViewModeVtt()) return;
            window.selectedToken = token;
            if (pointer.button === 2 && window.showTokenContextMenu) {
                window.showTokenContextMenu(token, pointer.event.clientX, pointer.event.clientY);
            }
            if (pointer.event.shiftKey && window.handleTokenMultiSelect) {
                window.handleTokenMultiSelect(token);
            }
        });

        token.on('drag', (pointer, dragX, dragY) => {
            if(isPlayerViewModeVtt() || this.ferramentaAtual !== 'select') return; 
            token.x = dragX;
            token.y = dragY;
            syncExtras();
            const fogPoint = this.getFogLocalPoint(token);
            this.fogRT.erase(this.fogBrush, fogPoint.x, fogPoint.y);
        });

        token.on('dragend', () => {
            if (isPlayerViewModeVtt()) return;
            const gridSize = this.getSceneGridSize();
            let offset = (token.gridSize % 2 === 0) ? 0 : (gridSize / 2);
            let targetX = Math.round(token.x / gridSize) * gridSize + offset;
            let targetY = Math.round(token.y / gridSize) * gridSize + offset;
            if (this.getSceneSettings().snapToGrid === false) {
                targetX = token.x;
                targetY = token.y;
            }

            // Deslize suave (Tween) em vez de teleporte instantâneo
            this.tweens.add({
                targets: token,
                x: targetX,
                y: targetY,
                duration: 200, // Tempo do deslize (200ms). Se quiser mais lento, coloque 400.
                ease: 'Power2',
                onUpdate: () => syncExtras(), // Atualiza a barra de HP/Aura acompanhando o movimento
                onComplete: () => {
                    syncExtras();
                    if (typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
                }
            });
        });
        
        token.on('destroy', () => {
            this.destroyTokenExtrasVtt(token);
        });

        return token;
    }

    destroyTokenExtrasVtt(token) {
        if (!token) return;
        if (token.auraGraphics && token.auraGraphics.scene) token.auraGraphics.destroy();
        if (token.elevText && token.elevText.scene) token.elevText.destroy();
        if (token.hpGraphics && token.hpGraphics.scene) token.hpGraphics.destroy();
        if (token.statusText && token.statusText.scene) token.statusText.destroy();
        if (token.conditionGroup && token.conditionGroup.scene) token.conditionGroup.destroy(true);
        token.auraGraphics = null;
        token.elevText = null;
        token.hpGraphics = null;
        token.statusText = null;
        token.conditionGroup = null;
    }

    clearTokenLayerVtt() {
        if (!this.camadaTokens?.list) return;
        [...this.camadaTokens.list].forEach(token => {
            this.destroyTokenExtrasVtt(token);
            if (token?.destroy) token.destroy();
        });
        this.camadaTokens.removeAll(false);
    }

    removePlayerTokenById(tokenId) {
        if (!tokenId || !this.camadaTokens?.list) return false;
        const token = this.camadaTokens.list.find(item => item.tokenId === tokenId || item.characterId === tokenId || item.id === tokenId);
        if (!token) return false;
        this.removeToken(token);
        return true;
    }

    // --- FUNÇÕES CHAMADAS PELO HTML (MENU DE CONTEXTO) ---
    setTokenElevation(token, value) {
        if (!token || !token.elevText) return;
        if (value && value.trim() !== '') {
            token.elevText.setText(value + 'm');
        } else {
            token.elevText.setText('');
        }
    }

    setTokenAura(token, hexColorStr, emoji) {
        if (!token || !token.auraGraphics) return;
        token.auraGraphics.clear();
        if (token.statusText) token.statusText.destroy(); // Limpa emoji antigo

        if (hexColorStr !== null) {
            token.auraColor = hexColorStr;
            // Converte string hex para numero do Phaser
            const hexNum = parseInt(hexColorStr.replace('#', '0x'));
            token.auraGraphics.lineStyle(4, hexNum, 0.8);
            token.auraGraphics.fillStyle(hexNum, 0.3);
            token.auraGraphics.fillCircle(0, 0, PIXELS_POR_UNIDADE / 1.5);
            token.auraGraphics.strokeCircle(0, 0, PIXELS_POR_UNIDADE / 1.5);
            
            // Adiciona o Emoji flutuante
            token.statusText = this.add.text(token.x + 20, token.y - 20, emoji || '', { fontSize: '20px' }).setOrigin(0.5);
            this.camadaUI.add(token.statusText);
        } else {
            token.auraColor = null;
        }
        if (!isPlayerViewModeVtt() && typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
    }

    renderTokenConditions(token) {
        if (!token) return;
        if (token.conditionGroup) token.conditionGroup.destroy(true);

        token.conditionGroup = this.add.container(token.x, token.y);
        this.camadaUI.add(token.conditionGroup);

        const conditions = Array.isArray(token.conditions) ? token.conditions : [];
        conditions.slice(0, 5).forEach((condition, index) => {
            const label = String(condition || '').trim();
            const badge = this.add.text(
                -((conditions.length - 1) * 13) + index * 26,
                -(token.displayHeight / 2) - 22,
                label.charAt(0).toUpperCase(),
                {
                    font: 'bold 12px Arial',
                    fill: '#fbbf24',
                    backgroundColor: '#05070bee',
                    padding: { x: 5, y: 3 }
                }
            ).setOrigin(0.5);
            token.conditionGroup.add(badge);
        });
    }

    updateTokenHP(tokenId, hpAtual, hpMax) {
        const token = this.camadaTokens.list.find(t => t.tokenId === tokenId);
        if (!token || !token.hpGraphics) return;
        token.hpAtual = hpAtual;
        token.hpMax = hpMax;
        const participant = window.combatState?.participants?.find(p => p.id === tokenId);
        if (participant) {
            participant.hpAtual = hpAtual;
            participant.hpMax = hpMax;
        }
        
        token.hpGraphics.clear();
        if (!hpMax || hpMax <= 0) return;

        const w = Math.max(36, (token.displayWidth || PIXELS_POR_UNIDADE) * 0.75);
        const h = 6;
        const offsetX = -w / 2;
        const offsetY = ((token.displayHeight || PIXELS_POR_UNIDADE) / 2) + 4;
        
        token.hpGraphics.fillStyle(0x000000, 0.8);
        token.hpGraphics.fillRect(offsetX, offsetY, w, h);
        
        const pct = Math.max(0, Math.min(1, hpAtual / hpMax));
        const color = pct > 0.5 ? 0x22c55e : (pct > 0.25 ? 0xeab308 : 0xef4444); // Saudavel -> Ferido -> Critico
        token.hpGraphics.fillStyle(color, 1);
        token.hpGraphics.fillRect(offsetX, offsetY, w * pct, h);
        if (typeof window.renderCombatTracker === 'function') window.renderCombatTracker();
        if (!isPlayerViewModeVtt() && typeof window.syncPlayerViewDebounced === 'function') window.syncPlayerViewDebounced();
    }

    clearCurrentTurnHighlight() {
        if (this.currentTurnMarker) {
            this.currentTurnMarker.destroy();
            this.currentTurnMarker = null;
        }
    }

    highlightCurrentTurnToken(token) {
        this.clearCurrentTurnHighlight();
        if (!token) return;

        const radius = Math.max(token.displayWidth || PIXELS_POR_UNIDADE, token.displayHeight || PIXELS_POR_UNIDADE) * 0.62;
        const marker = this.add.graphics();
        marker.lineStyle(5, 0xfbbf24, 0.95);
        marker.strokeCircle(0, 0, radius);
        marker.setPosition(token.x, token.y);
        this.camadaUI.add(marker);
        this.currentTurnMarker = marker;

        this.tweens.add({
            targets: marker,
            alpha: 0.35,
            scaleX: 1.12,
            scaleY: 1.12,
            duration: 720,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    bringTokenToFront(token) {
        if (!token) return;
        this.camadaTokens.bringToTop(token);
    }

    sendTokenToBack(token) {
        if (!token) return;
        this.camadaTokens.sendToBack(token);
    }

    enterResizeMode(token) {
        if (!token || this.resizingToken) return;
        
        this.resizingToken = token;
        this.mudarFerramenta('select');
        this.input.setDraggable(token, false);
        
        // PAUSA A RESPIRAÇÃO PARA DESTRAVAR A ESCALA
        if (token.breathTween) token.breathTween.stop();
        
        this.resizeBox = this.add.graphics();
        this.camadaUI.add(this.resizeBox);
        
        this.resizeHandle = this.add.rectangle(
            token.x + (token.displayWidth / 2), 
            token.y + (token.displayHeight / 2), 
            16, 16, 0xfbbf24
        ).setInteractive({ cursor: 'nwse-resize' });
        this.camadaUI.add(this.resizeHandle);
        
        this.input.setDraggable(this.resizeHandle, true);
        
        const updateBox = () => {
            this.resizeBox.clear();
            this.resizeBox.lineStyle(2, 0xfbbf24, 1);
            this.resizeBox.strokeRect(
                token.x - (token.displayWidth / 2), 
                token.y - (token.displayHeight / 2), 
                token.displayWidth, 
                token.displayHeight
            );
        };
        updateBox();

        this.resizeHandle.on('drag', (pointer, dragX, dragY) => {
            let newWidth = (dragX - token.x) * 2;
            if (newWidth < PIXELS_POR_UNIDADE / 2) newWidth = PIXELS_POR_UNIDADE / 2;
            
            token.displayWidth = newWidth;
            token.scaleY = token.scaleX;
            token.baseScale = token.scaleX; // SALVA A NOVA ESCALA BASE
            token.gridSize = Math.max(1, Math.round(newWidth / PIXELS_POR_UNIDADE)); // ATUALIZA O GRIDSIZE PARA O SNAP FUNCIONAR NO DRAG
            
            this.resizeHandle.setPosition(
                token.x + (token.displayWidth / 2), 
                token.y + (token.displayHeight / 2)
            );
            updateBox();
            
            token.auraGraphics.setPosition(token.x, token.y);
            token.auraGraphics.clear();
            if (token.statusText) {
                token.statusText.setPosition(token.x + 20, token.y - 20);
                if (window.phaserScene) window.phaserScene.setTokenAura(token, '#fbbf24', token.statusText.text);
            }
            token.hpGraphics.setPosition(token.x, token.y);
            if (token.hpAtual !== undefined && token.hpMax !== undefined) this.updateTokenHP(token.tokenId, token.hpAtual, token.hpMax);
            token.elevText.setPosition(token.x, token.y - (token.displayHeight / 2) - 10);
        });

        this.resizeEnterListener = (e) => {
            if (e.key === 'Enter') this.exitResizeMode();
        };
        window.addEventListener('keydown', this.resizeEnterListener);
    }

   exitResizeMode() {
        if (!this.resizingToken) return;
        const token = this.resizingToken;
        
        this.input.setDraggable(token, true);
        this.resizeBox.destroy();
        this.resizeHandle.destroy();
        window.removeEventListener('keydown', this.resizeEnterListener);
        
        // RECRIAR A ANIMAÇÃO DE RESPIRAÇÃO COM O NOVO TAMANHO
        if (token.breathTween) {
            token.breathTween = this.tweens.add({
                targets: token,
                scaleX: token.baseScale * 1.03, 
                scaleY: token.baseScale * 0.97, 
                duration: 1500 + Math.random() * 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        this.resizingToken = null;
    }

    removeToken(token) {
        if (!token) return;
        if (window.combatState?.participants) {
            window.combatState.participants = window.combatState.participants.filter(p => p.id !== token.tokenId);
            window.combatState.currentTurnIndex = Math.min(window.combatState.currentTurnIndex || 0, Math.max(0, window.combatState.participants.length - 1));
        }
        if (window.selectedToken === token) {
            window.selectedToken = null;
            if (typeof window.hideTokenQuickBar === 'function') window.hideTokenQuickBar();
        }
        if (typeof window.renderCombatTracker === 'function') window.renderCombatTracker();
        if (typeof window.highlightCurrentTurnToken === 'function') window.highlightCurrentTurnToken();
        if(token.auraGraphics) token.auraGraphics.destroy();
        if(token.hpGraphics) token.hpGraphics.destroy();
        if(token.elevText) token.elevText.destroy();
        if(token.statusText) token.statusText.destroy();
        if(token.conditionGroup) token.conditionGroup.destroy(true);
        token.destroy();
    }

    setFogOpacity(value) {
        if (this.fogRT) {
            this.fogRT.setAlpha(parseFloat(value));
        }
        const display = document.getElementById('fog-opacity-display');
        if (display) display.textContent = Math.round(value * 100) + '%';
    }

    undoLastDrawing() {
        if (this.drawingHistory.length > 0) {
            const last = this.drawingHistory.pop();
            this.redoHistory.push(last);
            if (last && last.setVisible) last.setVisible(false);
        }
    }

    redoLastUndo() {
        if (this.redoHistory.length > 0) {
            const last = this.redoHistory.pop();
            if (last && last.setVisible) last.setVisible(true);
            this.drawingHistory.push(last);
        }
    }

    clearFog() {
        if (this.fogRT) this.fogRT.clear();
        this.isFogCovered = false;
    }

    coverFog() {
        this.resetFogArea(true);
    }

    handleAltClickPing(pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (!this.pingGraphics) this.pingGraphics = this.add.graphics();
        this.pingGraphics.lineStyle(3, 0xfbbf24, 1);
        this.pingGraphics.strokeCircle(worldPoint.x, worldPoint.y, 15);
        this.pingGraphics.lineStyle(1, 0xfbbf24, 0.5);
        this.pingGraphics.strokeCircle(worldPoint.x, worldPoint.y, 40);
        this.tweens.add({ targets: this.pingGraphics, alpha: 0, duration: 1500, onComplete: () => this.pingGraphics.clear() });
        
        if (window.api && window.api.syncPing) {
            window.api.syncPing({ x: worldPoint.x, y: worldPoint.y });
        }
    }

    limparDesenho() {
        this.camadaTatico.removeAll(true);
        this.previewGraphics.clear();
        this.drawingHistory = [];
        this.redoHistory = [];
    }
}



const config = {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    scene: MainScene,
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE }
};
const game = new Phaser.Game(config);

window.deletarPersonagemBanco = function(charId, filePath) {
    if (confirm(`Atenção: Você tem certeza que deseja deletar a ficha de ${charId} permanentemente E excluir o arquivo de imagem do seu computador?`)) {
        if (window.api && window.api.deleteCharacter) {
            // 1. Deleta do banco de dados SQLite
            window.api.deleteCharacter(charId);
            
            // 2. Deleta o arquivo da pasta assets
            if (filePath && window.api.deleteFile) {
                window.api.deleteFile(filePath);
            }
            
            // 3. Remove da memória da sessão
            if (typeof fichasSalvas !== 'undefined' && fichasSalvas[charId]) {
                delete fichasSalvas[charId];
            } else if (window.fichasSalvas && window.fichasSalvas[charId]) {
                delete window.fichasSalvas[charId];
            }
            
            addChatMessage("Sistema", `Ficha e arquivo de ${charId} foram apagados.`, "#ef4444");
            
            // 4. Recarrega a UI
            if(window.phaserScene) window.phaserScene.refreshLibrary();
        }
    }
};
