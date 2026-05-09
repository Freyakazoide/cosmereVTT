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
    const safeTitle = escaparHtmlVtt(title);
    const safeFileName = escaparHtmlVtt(fileName || title);
    const safeSubtitle = escaparHtmlVtt(subtitle);
    const safeMeta = escaparHtmlVtt(meta);
    const safePath = escaparHtmlVtt(path);

    let previewHtml = `
        <span class="vtt-library-preview vtt-library-preview--icon">
            <i class="${icon}"></i>
        </span>
    `;

    if (preview && previewType === 'image') {
        previewHtml = `
            <span class="vtt-library-preview vtt-library-preview--image">
                <img src="file://${preview}" alt="${safeTitle}" loading="lazy">
            </span>
        `;
    }

    if (preview && previewType === 'video') {
        previewHtml = `
            <span class="vtt-library-preview vtt-library-preview--video">
                <video src="file://${preview}" muted preload="metadata"></video>
                <i class="fas fa-play"></i>
            </span>
        `;
    }

    return `
        <article class="vtt-library-card ${variant ? `vtt-library-card--${variant}` : ''}">
            <button class="vtt-library-card__main-action" type="button" onclick="${onClick}">
                ${previewHtml}

                <span class="vtt-library-card__content">
                    <strong>${safeFileName}</strong>
                    <small>${safeSubtitle}</small>
                    ${safeMeta ? `<em>${safeMeta}</em>` : ''}
                    ${safePath ? `<code>${safePath}</code>` : ''}
                </span>
            </button>

            ${actions ? `<div class="vtt-library-card__actions">${actions}</div>` : ''}
        </article>
    `;
}

function renderVttCategoryHeader(title, count = null) {
    const safeTitle = escaparHtmlVtt(title);
    const counter = Number.isFinite(count) ? `<span>${count}</span>` : '';

    return `
        <div class="vtt-category-header">
            <strong>${safeTitle}</strong>
            ${counter}
        </div>
    `;
}



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
        this.fogRT = this.add.renderTexture(0, 0, 4096, 4096).setOrigin(0.5).setAlpha(0.9); 
        this.camadaFog.add(this.fogRT);
        
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
                    window.api.syncPing(pMundo.x, pMundo.y);
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
                this.fogRT.erase(this.fogBrush, pMundo.x - this.fogRT.x, pMundo.y - this.fogRT.y);
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
                const relX = pMundo.x - this.fogRT.x + (this.fogRT.width / 2);
                const relY = pMundo.y - this.fogRT.y + (this.fogRT.height / 2);
                
                console.log(`[VTT FOG] Desenhando Névoa. X:${relX}, Y:${relY} | Modo: ${window.toolConfig.fogMode}`);
                
                if (window.toolConfig.fogMode === 'reveal') {
                    this.fogRT.erase(this.fogBrush, relX, relY); 
                } else {
                    this.fogRT.draw(this.fogBrushDark, relX, relY); 
                }
            }
            else if (this.ferramentaAtual === 'ruler') {
                this.graficosRegua.clear().lineStyle(2, 0xff6400, 1);
                this.graficosRegua.strokeLineShape(new Phaser.Geom.Line(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y));
                const distMetros = (Phaser.Math.Distance.Between(this.interactionStart.x, this.interactionStart.y, pMundo.x, pMundo.y) / PIXELS_POR_UNIDADE) * METROS_POR_QUADRADO;
                this.textoRegua.setVisible(true).setPosition(pMundo.x, pMundo.y - 20).setText(`${distMetros.toFixed(1)} m`);
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

    mudarFerramenta(nome) {
        this.ferramentaAtual = nome;
        
        if (nome !== 'ruler') {
            this.graficosRegua.clear();
            this.textoRegua.setVisible(false);
        }
        
        // Trava ou Destrava Tokens
        this.camadaTokens.list.forEach(token => {
            this.input.setDraggable(token, nome === 'select');
        });

        // Trava ou Destrava Mapas para montagem
        if (this.mapasAtivos) {
            this.mapasAtivos.forEach(mapa => {
                this.input.setDraggable(mapa, nome === 'map-edit');
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
        this.fogRT.clear();
        this.fogRT.fill(0x000000, 1); // Preto total
    }
    
    clearFog() {
        this.fogRT.clear(); 
    }

// --- CONTROLES DE CLIMA DINÂMICO ---
    setAdvancedWeather(config) {
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
    }

    // --- SISTEMA DE TABULEIRO (SAVE/LOAD) ---
    getBoardState() {
        const camera = this.cameras.main;
        const state = {
            version: 2,
            sceneName: '',
            camera: {
                x: camera.scrollX,
                y: camera.scrollY,
                zoom: camera.zoom
            },
            grid: {
                visible: this.grid ? this.grid.visible : true,
                size: PIXELS_POR_UNIDADE,
                metersPerSquare: METROS_POR_QUADRADO
            },
            weather: this.currentWeather || null,
            fog: {
                alpha: this.fogRT ? this.fogRT.alpha : 0.9,
                mode: window.toolConfig ? window.toolConfig.fogMode : 'reveal'
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
            pinnedNotes: window.pinnedNotes || [],
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
                    visibleToPlayers: t.visibleToPlayers !== false,
                    locked: !!t.locked,
                    notes: t.notes || ''
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
        state.mapas = state.mapas || state.maps || [];
        state.tokens = state.tokens || [];
        this.camadaMapa.removeAll(true);
        this.camadaTokens.removeAll(true);
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
        if (Array.isArray(state.revealedHandouts)) {
            window.revealedHandouts = state.revealedHandouts;
        }
        if (Array.isArray(state.drawings)) {
            state.drawings.forEach(d => this.restoreDrawing(d));
        }
        
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
                this.input.setDraggable(novoMapa, this.ferramentaAtual === 'map-edit');
                novoMapa.on('drag', (p, dx, dy) => { if(this.ferramentaAtual==='map-edit'){ novoMapa.x=dx; novoMapa.y=dy;} });
                novoMapa.on('dragend', () => { novoMapa.x = Math.round(novoMapa.x / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE; novoMapa.y = Math.round(novoMapa.y / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE; });
                if (m.scaleX) novoMapa.setScale(m.scaleX, m.scaleY || m.scaleX);
                this.mapasAtivos.push(novoMapa);
                this.camadaMapa.add(novoMapa);
            });
        });
        this.load.start();

        state.tokens.forEach(t => {
            const key = t.key || t.textureKey;
            const ext = t.path.split('.').pop().toLowerCase();
            const isVideo = ['webm', 'mp4'].includes(ext);
            
           if (!this.textures.exists(key) && !this.cache.video.has(key)) {
                if (isVideo) this.load.video(key, `file://${t.path}`);
                else this.load.image(key, `file://${t.path}`);
                
                this.load.once('complete', () => this.spawnTokenAt(key, t.path, t.x, t.y, t.elev || t.elevation, t.tokenId, isVideo, t.charName, t));
            } else {
                this.spawnTokenAt(key, t.path, t.x, t.y, t.elev || t.elevation, t.tokenId, isVideo, t.charName, t);
            }
        });
        this.load.start();
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
        if(window.api && window.api.getCharacters) {
            const dadosBrutos = await window.api.getCharacters();
            if (typeof window.fichasSalvas === 'undefined' && typeof fichasSalvas === 'undefined') {
                window.fichasSalvas = {};
            }
            const fichaRef = typeof fichasSalvas !== 'undefined' ? fichasSalvas : window.fichasSalvas;
            
            for (let id in dadosBrutos) {
                try {
                    fichaRef[id] = typeof dadosBrutos[id] === 'string' ? JSON.parse(dadosBrutos[id]) : dadosBrutos[id];
                } catch(e) { }
            }
        }
        
        const mapList = document.getElementById('map-list');
        const tokenList = document.getElementById('token-list');
        const audioList = document.getElementById('audio-list');
        const imgList = document.getElementById('images-list');
        const videoList = document.getElementById('videos-list');

        // Renderizar Vídeos Dinâmicos
        if (videoList && window.api.getVideos) {
    const videos = await window.api.getVideos();

    videoList.innerHTML = `
        ${renderVttCategoryHeader('Cenas e vídeos', videos.length)}
        <div class="vtt-library-stack">
            ${videos.map(v => {
                const path = normalizarCaminhoVtt(v.path);
                const name = limparExtensaoVtt(v.name);

                return renderVttLibraryCard({
    icon: 'fa-solid fa-film',
    title: name,
    fileName: v.name,
    subtitle: 'Vídeo / Cena cinematográfica',
    meta: 'Clique para pré-visualizar',
    path: path,
    preview: path,
    previewType: 'video',
    variant: 'video',
    onClick: `mostrarVideo('${path}')`,
    actions: `
        <button class="ui-icon-btn" type="button" onclick="showHandoutPathToPlayers('${path}', 'video', '${escaparHtmlVtt(v.name)}')" data-vtt-tooltip="Mostrar aos jogadores">
            <i class="fas fa-users"></i>
        </button>
    `
});
            }).join('')}
        </div>
    `;
}

        // Renderizar Imagens Dinâmicas
        if (imgList && window.api.getImages) {
    const imagens = await window.api.getImages();

    imgList.innerHTML = `
        ${renderVttCategoryHeader('Handouts visuais', imagens.length)}
        <div class="vtt-library-stack">
            ${imagens.map(i => {
                const path = normalizarCaminhoVtt(i.path);
                const name = limparExtensaoVtt(i.name);

                return renderVttLibraryCard({
    icon: 'fa-solid fa-image',
    title: name,
    fileName: i.name,
    subtitle: 'Imagem / Handout',
    meta: 'Material visual da campanha',
    path: path,
    preview: path,
    previewType: 'image',
    variant: 'image',
    onClick: `mostrarImagem('${path}')`,
    actions: `
        <button class="ui-icon-btn" type="button" onclick="showHandoutPathToPlayers('${path}', 'image', '${escaparHtmlVtt(i.name)}')" data-vtt-tooltip="Mostrar aos jogadores">
            <i class="fas fa-users"></i>
        </button>
    `
});
            }).join('')}
        </div>
    `;
}

       // Renderizar Áudios Dinâmicos Agrupados por Pasta
if (audioList && audios) {
    const agruparPorCategoria = (itens) => {
        return itens.reduce((acc, item) => {
            const categoria = item.category || 'Raiz';
            (acc[categoria] = acc[categoria] || []).push(item);
            return acc;
        }, {});
    };

    const audiosByCat = agruparPorCategoria(audios);

    audioList.innerHTML = Object.keys(audiosByCat).sort().map(cat => {
        const itensDaCategoria = audiosByCat[cat].sort((a, b) => {
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return `
            ${renderVttCategoryHeader(cat, itensDaCategoria.length)}
            <div class="vtt-library-stack">
                ${itensDaCategoria.map(a => {
                    const path = normalizarCaminhoVtt(a.path);
                    const name = limparExtensaoVtt(a.name);

                    return renderVttLibraryCard({
    icon: 'fa-solid fa-music',
    title: name,
    fileName: a.name,
    subtitle: 'Áudio / Ambiente',
    meta: cat === 'Raiz' ? 'Arquivo de áudio da mesa' : `Pasta: ${cat}`,
    path: path,
    previewType: 'icon',
    variant: 'audio',
    onClick: `playMusic('${path}', '${escaparHtmlVtt(a.name)}')`,
    actions: `
        <button class="ui-icon-btn" type="button" onclick="tocarJunto('${path}', '${escaparHtmlVtt(a.name)}')" data-vtt-tooltip="Tocar junto">
            <i class="fas fa-plus"></i>
        </button>
    `
});
                }).join('')}
            </div>
        `;
    }).join('');
}
        
        const agruparPorCategoria = (itens) => {
            return itens.reduce((acc, item) => {
                (acc[item.category] = acc[item.category] || []).push(item);
                return acc;
            }, {});
        };

        const mapsByCat = agruparPorCategoria(maps);
        const tokensByCat = agruparPorCategoria(tokens);

        // 1. PRIMEIRO CARREGAMOS AS FICHAS (Correção do erro de variável!)
        const fichaRefLocal = typeof fichasSalvas !== 'undefined' ? fichasSalvas : (window.fichasSalvas || {});

        // 2. DEPOIS RENDERIZAMOS OS MAPAS
        mapList.innerHTML = Object.keys(mapsByCat).sort().map(cat => `
            <div class="category-header">${cat}</div>
            ${mapsByCat[cat].map(m => `
                <div class="list-item" onclick="phaserScene.carregarMapa('${m.path.replace(/\\/g, '/')}', '${m.name}')">${m.name}</div>
            `).join('')}
        `).join('');

       // 3. Chama a função oficial do HTML para gerenciar a lista de atores/tokens,
        // garantindo que não tenha mais conflito de views.
        if (typeof window.renderizarListaTokens === 'function') {
            window.renderizarListaTokens();
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
                this.grid = this.add.grid(0, 0, 30000, 30000, PIXELS_POR_UNIDADE, PIXELS_POR_UNIDADE, 0, 0, 0x888888, 0.3);
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
            this.input.setDraggable(novoMapa, this.ferramentaAtual === 'map-edit');
            novoMapa.on('drag', (pointer, dragX, dragY) => { if (this.ferramentaAtual !== 'map-edit') return; novoMapa.x = dragX; novoMapa.y = dragY; });
            novoMapa.on('dragend', () => { novoMapa.x = Math.round(novoMapa.x / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE; novoMapa.y = Math.round(novoMapa.y / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE; });
            
            if (!this.mapasAtivos) this.mapasAtivos = [];
            this.mapasAtivos.push(novoMapa);
            this.camadaMapa.add(novoMapa);
        });
        this.load.start();
    }

   adicionarToken(nome, path) {
        const ext = path.split('.').pop().toLowerCase();
        const isVideo = ['webm', 'mp4'].includes(ext);
        
        // MÁGICA: Adicionamos o path (codificado) na chave do Phaser!
        // Assim, se você mudar a imagem do token, o Phaser sabe que é uma textura NOVA e não usa o cache antigo.
        const safePath = btoa(encodeURIComponent(path)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
        const key = `tk_${nome}_${safePath}`;
        
        if (!this.textures.exists(key) && !this.cache.video.has(key)) {
            if (isVideo) this.load.video(key, `file://${path}`);
            else this.load.image(key, `file://${path}`);
            
            this.load.once('complete', () => this.spawnTokenAt(key, path, this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, '', null, isVideo, nome));
            this.load.start();
        } else {
            this.spawnTokenAt(key, path, this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, '', null, isVideo, nome);
        }
    }

    spawnTokenAt(key, path, x, y, elev, savedTokenId, isVideo = false, charName = null, savedState = null) {
        if (isVideo === false && path) {
            const ext = path.split('.').pop().toLowerCase();
            isVideo = ['webm', 'mp4'].includes(ext);
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
        token.tokenId = savedTokenId || ('tk_' + Date.now() + '_' + Math.floor(Math.random() * 1000)); 

        this.input.setDraggable(token, this.ferramentaAtual === 'select');
        token.gridSize = savedState?.gridSize || 1;
        token.displayWidth = PIXELS_POR_UNIDADE * token.gridSize; 
        token.scaleY = token.scaleX;
        if (savedState?.scaleX) {
            token.setScale(savedState.scaleX, savedState.scaleY || savedState.scaleX);
        }
        token.visibleToPlayers = savedState?.visibleToPlayers !== false;
        token.locked = !!savedState?.locked;
        token.notes = savedState?.notes || '';
        token.hpAtual = savedState?.hp;
        token.hpMax = savedState?.hpMax;
        
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
        };
        syncExtras();
        if (savedState?.aura) {
            this.setTokenAura(token, savedState.aura, savedState.auraEmoji || savedState.status);
        }
        if (savedState?.hp !== undefined && savedState?.hpMax !== undefined) {
            this.updateTokenHP(token.tokenId, savedState.hp, savedState.hpMax);
        }

        token.on('pointerdown', (pointer) => {
            if (pointer.button === 2 && window.showTokenContextMenu) {
                window.showTokenContextMenu(token, pointer.event.clientX, pointer.event.clientY);
            }
            if (pointer.event.shiftKey && window.handleTokenMultiSelect) {
                window.handleTokenMultiSelect(token);
            }
        });

        token.on('drag', (pointer, dragX, dragY) => {
            if(this.ferramentaAtual !== 'select') return; 
            token.x = dragX;
            token.y = dragY;
            syncExtras();
            const relX = token.x - this.fogRT.x + (this.fogRT.width / 2);
            const relY = token.y - this.fogRT.y + (this.fogRT.height / 2);
            this.fogRT.erase(this.fogBrush, relX, relY);
        });

        token.on('dragend', () => {
            let offset = (token.gridSize % 2 === 0) ? 0 : (PIXELS_POR_UNIDADE / 2);
            let targetX = Math.round(token.x / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE + offset;
            let targetY = Math.round(token.y / PIXELS_POR_UNIDADE) * PIXELS_POR_UNIDADE + offset;

            // Deslize suave (Tween) em vez de teleporte instantâneo
            this.tweens.add({
                targets: token,
                x: targetX,
                y: targetY,
                duration: 200, // Tempo do deslize (200ms). Se quiser mais lento, coloque 400.
                ease: 'Power2',
                onUpdate: () => syncExtras(), // Atualiza a barra de HP/Aura acompanhando o movimento
                onComplete: () => syncExtras()
            });
        });
        
        token.on('destroy', () => {
            if(token.auraGraphics) token.auraGraphics.destroy();
            if(token.elevText) token.elevText.destroy();
            if(token.hpGraphics) token.hpGraphics.destroy();
            if(token.statusText) token.statusText.destroy();
        });
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
    }

    updateTokenHP(tokenId, hpAtual, hpMax) {
        const token = this.camadaTokens.list.find(t => t.tokenId === tokenId);
        if (!token || !token.hpGraphics) return;
        token.hpAtual = hpAtual;
        token.hpMax = hpMax;
        
        token.hpGraphics.clear();
        if (hpAtual >= hpMax && hpMax > 0) return; // Esconde se estiver full vida

        const w = PIXELS_POR_UNIDADE * 0.8;
        const h = 6;
        const offsetX = -w / 2;
        const offsetY = (PIXELS_POR_UNIDADE / 2) + 4;
        
        token.hpGraphics.fillStyle(0x000000, 0.8);
        token.hpGraphics.fillRect(offsetX, offsetY, w, h);
        
        const pct = Math.max(0, Math.min(1, hpAtual / hpMax));
        const color = pct > 0.5 ? 0x22c55e : (pct > 0.2 ? 0xeab308 : 0xef4444); // Verde -> Amarelo -> Vermelho
        token.hpGraphics.fillStyle(color, 1);
        token.hpGraphics.fillRect(offsetX, offsetY, w * pct, h);
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
        if(token.auraGraphics) token.auraGraphics.destroy();
        if(token.hpGraphics) token.hpGraphics.destroy();
        if(token.elevText) token.elevText.destroy();
        if(token.statusText) token.statusText.destroy();
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
        this.fogRT.clear();
    }

    coverFog() {
        this.fogRT.clear();
        this.fogRT.fill(0x000000, 1);
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
