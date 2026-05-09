                // ONDE SUBSTITUIR (Pode colar logo abaixo da tag <script> no index.html)
        function abrirPuzzle1() {
            // Como você usa Electron, isso abre uma nova janela limpa, como um mini-game real
            window.open('puzzle1.html', 'PuzzleRadiante', 'width=900,height=700,webPreferences=nodeIntegration=no');
        }

        let currentActivePanel = null;

        function closeFlyoutPanel() {
            const panel = document.getElementById('sidebar');
            if (panel) panel.classList.add('is-closed');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.content-area').forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            currentActivePanel = null;
        }

        function openFlyoutPanel(targetId, title) {
            const panel = document.getElementById('sidebar');
            const titleEl = document.getElementById('vtt-flyout-title');
            const target = document.getElementById(targetId);
            const optionsPanel = document.getElementById('tool-options');
            if (!panel || !target) return;

            if (currentActivePanel === targetId && !panel.classList.contains('is-closed')) {
                closeFlyoutPanel();
                return;
            }

            document.querySelectorAll('.content-area').forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (optionsPanel) optionsPanel.classList.add('hidden');

            target.classList.remove('hidden');
            target.classList.add('active');
            panel.classList.remove('is-closed');
            if (titleEl) titleEl.textContent = title || targetId.replace('-content', '');

            document.querySelectorAll(`[data-target-id="${targetId}"]`).forEach(btn => btn.classList.add('active'));
            currentActivePanel = targetId;
        }

        function toggleMenu() {
            if (currentActivePanel) closeFlyoutPanel();
            else switchTab('maps');
        }

        function toggleSidebarCollapse() {
            closeFlyoutPanel();
        }

       function toggleRosterCardTouch(card) {
            card.classList.toggle('touch-active');
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.roster-card') && !e.target.closest('#sidebar')) {
                document.querySelectorAll('.roster-card.touch-active').forEach(card => {
                    card.classList.remove('touch-active');
                });
            }
        });

        function switchTab(tab) {
            const targetId = tab.endsWith('-content') ? tab : `${tab}-content`;
            const btn = document.querySelector(`[data-target-id="${targetId}"]`);
            openFlyoutPanel(targetId, btn?.dataset.title || btn?.title || tab);
        }

        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('[data-target-id]').forEach(btn => {
                btn.addEventListener('click', () => openFlyoutPanel(btn.dataset.targetId, btn.dataset.title || btn.title));
            });
            closeFlyoutPanel();
        });

       // Estado Global das Ferramentas
        window.toolConfig = { color: 0xcc0000, thickness: 3, shape: 'circle', fogMode: 'reveal' };
        const colors = [
            { hex: '#ef4444', val: 0xef4444 }, // Vermelho
            { hex: '#3b82f6', val: 0x3b82f6 }, // Azul
            { hex: '#22c55e', val: 0x22c55e }, // Verde
            { hex: '#eab308', val: 0xeab308 }, // Amarelo
            { hex: '#ffffff', val: 0xffffff }, // Branco
            { hex: '#000000', val: 0x000000 }  // Preto
        ];

        function renderColorPalette() {
            return colors.map(c => `<div class="color-swatch ${window.toolConfig.color === c.val ? 'active' : ''}" style="background: ${c.hex};" onclick="updateConfig('color', ${c.val}, this)"></div>`).join('');
        }

        function updateConfig(key, value, element) {
            window.toolConfig[key] = value;
            if (key === 'color' && element) {
                document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('active'));
                element.classList.add('active');
            }
        }

        function setTool(toolName, btnElement) {
            closeFlyoutPanel();
            document.querySelectorAll('.dock-section:first-child .tool-btn').forEach(b => b.classList.remove('active'));
            if (btnElement) btnElement.classList.add('active');
            
            const optionsPanel = document.getElementById('tool-options');
            optionsPanel.innerHTML = '';
            optionsPanel.classList.remove('hidden');
            
            if (toolName === 'select') {
                optionsPanel.innerHTML = `
                    <div class="prop-group">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="checkbox" id="snap-grid" checked style="accent-color:var(--accent);">
                            Snap to Grid
                        </label>
                    </div>
                `;
            } else if (toolName === 'draw') {
                optionsPanel.innerHTML = `
                    <div class="prop-group"><strong><i class="fas fa-palette"></i> Cor:</strong> ${renderColorPalette()}</div>
                    <div class="prop-group" style="margin-left: auto;"><strong>Grossura:</strong> 
                        <input type="range" class="styled-slider" min="1" max="15" value="${window.toolConfig.thickness}" oninput="updateConfig('thickness', parseInt(this.value))">
                    </div>
                `;
            } else if (toolName === 'dice') {
                optionsPanel.innerHTML = `
                    <div class="prop-group" style="gap: 12px; align-items: center; padding: 5px;">
                        <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding: 5px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
                            <label style="color:var(--text-dim); font-size: 10px; text-transform:uppercase;">Qtd</label>
                            <input type="number" id="dice-qty" value="1" min="1" style="width: 35px; background:transparent; color:#fff; border:none; outline:none; font-weight:bold; font-size:14px;">
                        </div>
                        <select id="dice-type" class="styled-select" style="width: 80px;">
                            <option value="4">d4</option>
                            <option value="6">d6</option>
                            <option value="8">d8</option>
                            <option value="10">d10</option>
                            <option value="12">d12</option>
                            <option value="20" selected>d20</option>
                            <option value="100">d100</option>
                        </select>
                        <button class="glass-btn primary" onclick="rollDice()" style="padding: 8px 20px;"><i class="fas fa-dice-d20"></i> RODAR</button>
                    </div>`;
            } else if (toolName === 'ruler') {
                const unitSaved = localStorage.getItem('ruler-unit') || 'metros';
                optionsPanel.innerHTML = `
                    <div class="prop-group">
                        <label style="font-size:11px;">Unidade:</label>
                        <select id="ruler-unit" onchange="localStorage.setItem('ruler-unit', this.value)" style="background:rgba(0,0,0,0.6); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:11px;">
                            <option value="metros" ${unitSaved === 'metros' ? 'selected' : ''}>Metros</option>
                            <option value="pes" ${unitSaved === 'pes' ? 'selected' : ''}>Pés</option>
                            <option value="quadrados" ${unitSaved === 'quadrados' ? 'selected' : ''}>Quadrados</option>
                        </select>
                    </div>
                    <div class="prop-group">
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px;">
                            <input type="checkbox" id="hex-grid" ${localStorage.getItem('hex-grid') === 'true' ? 'checked' : ''} onchange="localStorage.setItem('hex-grid', this.checked)" style="accent-color:var(--accent);">
                            Grid Hexagonal
                        </label>
                    </div>
                `;
            } else if (toolName === 'aoe') {
                optionsPanel.innerHTML = `
                    <div class="prop-group"><strong><i class="fas fa-palette"></i> Cor:</strong> ${renderColorPalette()}</div>
                    <div class="prop-group" style="margin-left: auto;"><strong><i class="fas fa-shapes"></i> Formato:</strong> 
                        <select class="styled-select" onchange="updateConfig('shape', this.value)">
                            <option value="circle" ${window.toolConfig.shape === 'circle' ? 'selected' : ''}>Círculo</option>
                            <option value="square" ${window.toolConfig.shape === 'square' ? 'selected' : ''}>Quadrado</option>
                            <option value="cone" ${window.toolConfig.shape === 'cone' ? 'selected' : ''}>Cone / Triângulo</option>
                        </select>
                    </div>
                `;
            } else if (toolName === 'fog') {
                optionsPanel.innerHTML = `
                    <div class="prop-group" style="width: 100%; justify-content: space-between;">
                        <select class="styled-select" onchange="updateConfig('fogMode', this.value)">
                            <option value="reveal" ${window.toolConfig.fogMode === 'reveal' ? 'selected' : ''}>Revelar (Borracha)</option>
                            <option value="hide" ${window.toolConfig.fogMode === 'hide' ? 'selected' : ''}>Esconder (Pintar)</option>
                        </select>
                        <button onclick="if(window.phaserScene) window.phaserScene.coverFog()" style="background:#1e293b; color:#fff; padding:6px; border-radius:4px; cursor:pointer;">Cobrir Tudo</button>
                        <button onclick="if(window.phaserScene) window.phaserScene.clearFog()" style="color:#ef4444; background:transparent; border:none; cursor:pointer;">Limpar</button>
                    </div>`;
            } else if (toolName === 'weather') {
                const windSaved = localStorage.getItem('wind-dir') || '0';
                optionsPanel.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                        <div class="prop-group">
                            <label style="width: 80px;">🌪️ Cinzas:</label>
                            <input type="range" class="styled-slider" id="int-ash" min="0" max="100" value="0" oninput="updateWeatherSettings()">
                        </div>
                        <div class="prop-group">
                            <label style="width: 80px;">🌧️ Chuva:</label>
                            <input type="range" class="styled-slider" id="int-rain" min="0" max="100" value="0" oninput="updateWeatherSettings()">
                        </div>
                        <div class="prop-group">
                            <label style="width: 80px;">☀️ Sol:</label>
                            <input type="range" class="styled-slider" id="int-sun" min="0" max="100" value="0" oninput="updateWeatherSettings()">
                        </div>
                        <div class="prop-group">
                            <label style="width: 80px;">💨 Vento:</label>
                            <input type="range" class="styled-slider" id="wind-dir" min="-5" max="5" value="${windSaved}" oninput="localStorage.setItem('wind-dir', this.value); updateWeatherSettings();">
                            <span id="wind-val" style="font-size:10px; min-width:20px;">${windSaved}</span>
                        </div>
                    </div>`;
            } else {
                optionsPanel.classList.add('hidden');
            }

            if(window.phaserScene) window.phaserScene.mudarFerramenta(toolName);
        }

        function updateWeatherSettings() {
            const windEl = document.getElementById('wind-dir');
            const windVal = windEl ? parseInt(windEl.value) || 0 : 0;
            const windDisplay = document.getElementById('wind-val');
            if (windDisplay) windDisplay.textContent = windVal;
            
            const config = {
                ash: parseInt(document.getElementById('int-ash').value) || 0,
                rain: parseInt(document.getElementById('int-rain').value) || 0,
                sun: parseInt(document.getElementById('int-sun').value) || 0,
                wind: windVal
            };
            if(window.phaserScene) window.phaserScene.setAdvancedWeather(config);
        }
        
        function clearDraw() {
            if (confirm("Tem certeza que deseja apagar todos os desenhos? Esta ação não pode ser desfeita.")) {
                if(window.phaserScene) window.phaserScene.limparDesenho();
            }
        }

        function deleteContextToken() {
            if(window.phaserScene && activeTokenForContext) window.phaserScene.removeToken(activeTokenForContext);
            document.getElementById('context-menu').classList.add('hidden');
        }

        function toggleHelp() {
            document.getElementById('help-modal').classList.toggle('hidden');
        }

        // --- SISTEMA DE ATALHOS GLOBAIS ---
        window.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement.tagName;
            // Libera os atalhos nativos para inputs, textareas e divs editáveis (nosso editor de notas)
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable) return;

            const key = e.key.toLowerCase();
            
            if (e.ctrlKey && key >= '1' && key <= '9') {
                e.preventDefault();
                const idx = parseInt(key) - 1;
                const soundMap = [
                    '../assets/audios/ambiente/chuva.mp3',
                    '../assets/audios/ambiente/vento.mp3',
                    '../assets/audios/ambiente/fogo.mp3',
                    '../assets/audios/ambiente/cidade.mp3',
                    '../assets/audios/ambiente/floresta.mp3',
                    '../assets/audios/ambiente/mar.mp3',
                    '../assets/audios/ambiente/trovoada.mp3',
                    '../assets/audios/ambiente/noite.mp3',
                    '../assets/audios/ambiente/taverna.mp3'
                ];
                const soundNames = ['Chuva', 'Vento', 'Fogo', 'Cidade', 'Floresta', 'Mar', 'Trovoada', 'Noite', 'Taverna'];
                if (soundMap[idx]) tocarJunto(soundMap[idx], soundNames[idx] + '.mp3');
                return;
            }

            const tools = {
                's': { name: 'select', index: 0 },
                'm': { name: 'map-edit', index: 1 },
                'd': { name: 'draw', index: 2 },
                'e': { name: 'eraser', index: 3 },
                'r': { name: 'ruler', index: 4 },
                'a': { name: 'aoe', index: 5 },
                'n': { name: 'fog', index: 6 }
            };

            if (tools[key]) {
                const btnArray = document.querySelectorAll('.dock-section:first-child .tool-btn');
                if (btnArray[tools[key].index]) {
                    setTool(tools[key].name, btnArray[tools[key].index]);
                }
            } else if (key === 'c') { clearDraw(); } 
            else if (key === 'f') { toggleMenu(); } 
            else if (key === 'i') { toggleInitiative(); }
            else if (e.ctrlKey && key === 'z') {
                e.preventDefault();
                if (window.phaserScene) window.phaserScene.undoLastDrawing();
            }
            else if (e.ctrlKey && key === 'y') {
                e.preventDefault();
                if (window.phaserScene) window.phaserScene.redoLastUndo();
            }
            else if (key === 'l' && !e.ctrlKey) {
                toggleMapLock();
            }
        });

        


        // --- SISTEMA DE MENU DE CONTEXTO DO TOKEN ---
        let activeTokenForContext = null;

        function showTokenContextMenu(tokenObj, x, y) {
            activeTokenForContext = tokenObj;
            const menu = document.getElementById('context-menu');
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
        }

        function showMapContextMenu(x, y) {
            const menu = document.getElementById('map-context-menu');
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
        }

        // Esconde menu se clicar fora
        window.addEventListener('click', (e) => {
            if(!e.target.closest('#context-menu')) document.getElementById('context-menu').classList.add('hidden');
            if(!e.target.closest('#map-context-menu')) document.getElementById('map-context-menu').classList.add('hidden');
        });

        function setContextElevation() {
            const val = window.confirm("Subir elevação? (OK para subir, Cancelar para limpar)") ? "3" : "";
            if(window.phaserScene && activeTokenForContext) window.phaserScene.setTokenElevation(activeTokenForContext, val);
            document.getElementById('context-menu').classList.add('hidden');
        }
        function setContextAura(hexColor, condicaoLabel, emoji) {
    if (!window.phaserScene || !activeTokenForContext) return;

    window.phaserScene.setTokenAura(activeTokenForContext, hexColor, emoji);
    addChatMessage('Sistema', `${emoji} <strong>${activeTokenForContext.texture.key.replace('tk_','')}</strong>: ${condicaoLabel}`, hexColor);

    const tokenNome = activeTokenForContext.charName || activeTokenForContext.texture.key.replace('tk_', '').split('_')[0];
    const initEntry = initiativeList.find(e => e.name.toLowerCase() === tokenNome.toLowerCase());
    if (initEntry) {
        const cond = CONDICOES.find(c => c.label === condicaoLabel);
        if (cond && !initEntry.conditions.find(c => c.id === cond.id)) {
            initEntry.conditions.push({ id: cond.id });
            renderInitiative();
        }
    }

    document.querySelectorAll('.token-item').forEach(item => {
        const nameEl = item.querySelector('[style*="font-size: 12px"], [style*="font-size:12px"]');
        if (nameEl && nameEl.textContent.trim().toLowerCase() === tokenNome.toLowerCase()) {
            item.style.boxShadow = `0 0 8px ${hexColor}44, inset 0 0 8px ${hexColor}22`;
            item.style.borderLeftColor = hexColor;
            let badge = item.querySelector('.condition-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'condition-badge';
                item.appendChild(badge);
            }
            badge.textContent = emoji || '';
        }
    });

    document.getElementById('context-menu').classList.add('hidden');
}

function clearContextAuras() {
    if (!window.phaserScene || !activeTokenForContext) return;

    window.phaserScene.setTokenAura(activeTokenForContext, null, null);
    window.phaserScene.setTokenElevation(activeTokenForContext, null);
    addChatMessage('Sistema', 'Condições removidas.', '#94a3b8');

    const tokenNome = activeTokenForContext.charName || activeTokenForContext.texture.key.replace('tk_', '').split('_')[0];
    const initEntry = initiativeList.find(e => e.name.toLowerCase() === tokenNome.toLowerCase());
    if (initEntry) {
        initEntry.conditions = [];
        renderInitiative();
    }

    document.getElementById('context-menu').classList.add('hidden');
}


        // Inicializar a estrutura
        // Sistema de Sons Rápidos (Token) - Menu Flutuante
        function abrirSonsToken() {
            if (!activeTokenForContext) return;
            const charName = activeTokenForContext.charName || activeTokenForContext.texture.key.replace('tk_', '').split('_')[0];
            const menu = document.getElementById('token-sound-menu');
            const ctxMenu = document.getElementById('context-menu');
            
            window.api.getAudio().then(audios => {
                const sonsDoToken = audios.filter(a => a.name.toLowerCase().startsWith(charName.toLowerCase() + "_"));
                
                if (sonsDoToken.length === 0) {
                    addChatMessage("Sistema", `Nenhum som encontrado para ${charName}.`, "#ef4444");
                    return;
                }

                menu.innerHTML = `<div style="font-size:10px; color:var(--accent); margin-bottom:5px; text-align:center;">SONS: ${charName.toUpperCase()}</div>`;
                sonsDoToken.forEach(a => {
                    const btn = document.createElement('button');
                    btn.className = 'list-item';
                    btn.style.width = '100%';
                    btn.innerHTML = `<i class="fas fa-play"></i> ${a.name.split('_')[1].replace(/\.[^/.]+$/, "")}`;
                    btn.onclick = () => {
                        const sfx = new Audio(`file://${a.path.replace(/\\/g, '/')}`);
                        sfx.volume = document.getElementById('audio-volume').value;
                        sfx.play();
                        addChatMessage(charName, `*${a.name.split('_')[1].replace(/\.[^/.]+$/, "")}*`, "#94a3b8");
                        menu.classList.add('hidden');
                    };
                    menu.appendChild(btn);
                });

                menu.style.left = ctxMenu.style.left;
                menu.style.top = ctxMenu.style.top;
                menu.classList.remove('hidden');
            });
            
            ctxMenu.classList.add('hidden');
        }

        // Fecha menus ao clicar fora
        window.addEventListener('click', (e) => {
            if(!e.target.closest('#context-menu') && !e.target.closest('#token-sound-menu')) {
                document.getElementById('context-menu').classList.add('hidden');
                document.getElementById('token-sound-menu').classList.add('hidden');
            }
        });

        // Sistema de uso de Itens do Compêndio
        function usarItem(nome, efeito, cor) {
            addChatMessage("Jogador", `Sacou: <strong style="color:${cor}">${nome}</strong><br><span style="font-size:11px; opacity:0.8;">Efeito: ${efeito}</span>`, "#fff");
        }


        function filtrarSidebar(termo) {
            termo = termo.toLowerCase();
            // Pega todos os itens das listas e tokens
            const itens = document.querySelectorAll('.list-item, .token-item');
            
            itens.forEach(item => {
                const texto = item.innerText.toLowerCase();
                // Se o termo estiver vazio ou contido no texto, mostra; senão, esconde.
                item.style.display = (termo === '' || texto.includes(termo)) ? '' : 'none';
            });

            // Esconde os cabeçalhos de categoria (ex: "Personagens", "Monstros") se todos os itens dentro deles estiverem escondidos
            document.querySelectorAll('.category-header').forEach(header => {
                if (termo === '') {
                    header.style.display = '';
                    return;
                }
                let temVisivel = false;
                let next = header.nextElementSibling;
                while(next && !next.classList.contains('category-header')) {
                    if(next.style.display !== 'none') temVisivel = true;
                    next = next.nextElementSibling;
                }
                header.style.display = temVisivel ? '' : 'none';
            });
        }
        
        // =============================================
// SISTEMA DE TEMAS
// =============================================
function aplicarTema(tema) {
    document.body.className = document.body.className
        .replace(/theme-\S+/g, '').trim();
    if (tema && tema !== 'default') {
        document.body.classList.add('theme-' + tema);
    }
    localStorage.setItem('cosmere-tema', tema);
}

// Restaurar tema salvo ao carregar
(function() {
    const temaSalvo = localStorage.getItem('cosmere-tema');
    if (temaSalvo) aplicarTema(temaSalvo);
    const diceColor = localStorage.getItem('dice-color');
    if (diceColor) {
        const colorInput = document.getElementById('player-dice-color');
        if (colorInput) colorInput.value = diceColor;
    }
})();


// =============================================
// PARTÍCULAS DE INVESTIDURA
// =============================================
(function() {
    // Cria o canvas overlay sobre a sidebar
    const sidebar = document.getElementById('sidebar');
    const canvas = document.createElement('canvas');
    canvas.id = 'investidura-canvas';
    sidebar.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animFrame = null;

    function resizeCanvas() {
        canvas.width  = sidebar.offsetWidth;
        canvas.height = sidebar.offsetHeight;
    }
    resizeCanvas();
    new ResizeObserver(resizeCanvas).observe(sidebar);

    // Configurações por tipo de investidura
    const TIPOS = {
        tempestade: {
            colors: ['#38bdf8', '#7dd3fc', '#ffffff', '#bae6fd'],
            count: 40, speed: 3.5, size: [2, 5], lifetime: 90
        },
        ruina: {
            colors: ['#6b21a8', '#1e1e2e', '#4c1d95', '#7c3aed'],
            count: 35, speed: 1.8, size: [2, 4], lifetime: 120
        },
        critico: {
            colors: ['#fbbf24', '#fcd34d', '#ffffff', '#f59e0b'],
            count: 55, speed: 4,   size: [2, 6], lifetime: 80
        }
    };

    function spawnParticles(tipo) {
        const cfg = TIPOS[tipo] || TIPOS.critico;
        for (let i = 0; i < cfg.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = cfg.speed * (0.5 + Math.random());
            particles.push({
                x: Math.random() * canvas.width,
                y: canvas.height * (0.3 + Math.random() * 0.4),
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 1.5,
                size: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
                color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
                life: cfg.lifetime,
                maxLife: cfg.lifetime
            });
        }
        if (!animFrame) loopParticles();
    }

    function loopParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter(p => p.life > 0);

        particles.forEach(p => {
            p.x  += p.vx;
            p.y  += p.vy;
            p.vy += 0.06; // gravidade leve
            p.life--;

            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur  = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;

        if (particles.length > 0) {
            animFrame = requestAnimationFrame(loopParticles);
        } else {
            animFrame = null;
        }
    }

    // Expõe globalmente para os outros sistemas chamarem
    window.triggerInvestidura = spawnParticles;
})();


// =============================================
// INTEGRAÇÃO: disparo automático de partículas
// =============================================

// Sobrescrever addChatMessage para detectar críticos
const _addChatMessageOriginal = addChatMessage;
addChatMessage = function(sender, message, color) {
    _addChatMessageOriginal(sender, message, color);

    const texto = (message || '').toLowerCase();
    if (texto.includes('crítico') || texto.includes('critico')) {
        window.triggerInvestidura('critico');
    }
};

// Detectar gasto de Investidura na ficha (hook nos inputs de Investidura)
document.addEventListener('DOMContentLoaded', () => {
    // Observa mudanças no campo de Investidura da ficha
    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'vital-invest-atual') {
            const antes  = parseInt(e.target.dataset.lastVal || e.target.value);
            const depois = parseInt(e.target.value);
            if (depois < antes) {
                // Gastou Investidura
                const tema = localStorage.getItem('cosmere-tema') || 'default';
                const tipo = tema === 'theme-roshar' ? 'tempestade' : 'critico';
                window.triggerInvestidura(tipo);
            }
            e.target.dataset.lastVal = depois;
        }
    });
});

// =============================================
// CLICK-TO-ROLL — Motor de rolagem da ficha
// =============================================

/**
 * Rola dados a partir de um elemento da ficha.
 * @param {string} notacao  - ex: "1d8", "2d6", "1d20"
 * @param {number} mod      - modificador fixo a somar
 * @param {string} label    - nome exibido no chat ("Lança de Vidro-Chama")
 * @param {string} tipo     - 'arma' | 'pericia' | 'atributo'
 */
