// Character sheet, actor roster and sheet rolls.
// Extracted from app.js to keep the renderer bootstrap smaller while preserving public globals.


// --- Extracted block: core ---
// --- SISTEMA DE FICHA DE PERSONAGEM (PRO) ---
        
       // Estrutura mapeada exatamente do PDF Oficial (Atributos e suas Perícias)
        const atributos_rpg = [
            { nome: "FORÇA", pericias: ["Armamento Pesado", "Atletismo"], classe: "attr-forca" },
            { nome: "VELOCIDADE", pericias: ["Agilidade", "Armamento Leve", "Furtividade", "Ladinagem"], classe: "attr-velocidade" },
            { nome: "INTELECTO", pericias: ["Dedução", "Manufatura", "Medicina", "Saber"], classe: "attr-intelecto" },
            { nome: "VONTADE", pericias: ["Disciplina", "Intimidação"], classe: "attr-vontade" },
            { nome: "CONSCIÊNCIA", pericias: ["Intuição", "Percepção", "Sobrevivência"], classe: "attr-consciencia" },
            { nome: "PRESENÇA", pericias: ["Dissimulação", "Liderança", "Persuasão"], classe: "attr-presenca" }
        ];

        function escapeSheetHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char]));
        }

        function renderSkillDots(rank = 0) {
            let dots = '';
            for (let i = 0; i < 9; i++) {
                dots += `<button type="button" class="skill-dot ${i < rank ? 'filled' : ''}" data-action="toggle-skill-dot" aria-label="Nivel ${i + 1}"></button>`;
            }
            return dots;
        }

        function renderSkillRow(name, rank = 0, rollable = false) {
            const safeName = escapeSheetHtml(name);
            const rollClass = rollable ? ' rollable' : '';
            const rollAttrs = rollable ? ` data-action="roll-skill" title="Clique para rolar ${safeName}"` : '';

            return `
                <div class="skill-row">
                    <span class="skill-name">
                        <span class="s-text${rollClass}"${rollAttrs}>${safeName}</span>
                        <button type="button" class="skill-delete-btn" data-action="delete-skill" title="Remover pericia" aria-label="Remover pericia">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                    <div class="skill-rank">${renderSkillDots(rank)}</div>
                </div>
            `;
        }

        function renderAttrHeader(attrName, value = 10, includeRoll = false) {
            const safeName = escapeSheetHtml(attrName);
            return `
                <div class="attr-header">
                    <span class="attr-title">
                        ${safeName}
                        <button type="button" class="attr-add-skill" data-action="add-skill" data-attr-name="${safeName}" title="Adicionar pericia" aria-label="Adicionar pericia">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                        ${includeRoll ? `<button type="button" class="attr-roll-btn" data-action="roll-attr" data-attr-name="${safeName}" title="Rolar teste de ${safeName}">1d20</button>` : ''}
                    </span>
                    <input type="text" class="attr-value-input" value="${escapeSheetHtml(value)}">
                    <span class="attr-mod"></span>
                </div>
            `;
        }

        function renderizarAtributosEPericias() {
            const container = document.getElementById('dynamic-skills-container');
            container.innerHTML = '';
            
            atributos_rpg.forEach(attr => {
                let periciasHTML = attr.pericias.map(pericia => {
                    return renderSkillRow(pericia);
                }).join('');

                container.innerHTML += `
                    <div class="attr-block ${attr.classe}" data-attr-name="${attr.nome}">
                        ${renderAttrHeader(attr.nome)}
                        <div class="attr-skills">${periciasHTML}</div>
                    </div>
                `;
            });
        }

        let atributoAlvoParaPericia = "";

        function abrirModalNovaPericia(attrNome) {
            atributoAlvoParaPericia = attrNome;
            document.getElementById('new-skill-name-input').value = '';
            document.getElementById('add-skill-modal').classList.remove('hidden');
            document.getElementById('new-skill-name-input').focus();
        }

        function fecharModalNovaPericia() {
            document.getElementById('add-skill-modal').classList.add('hidden');
        }

        function confirmarNovaPericia() {
            const nome = document.getElementById('new-skill-name-input').value.trim();
            if(!nome) return;

            // CORREÇÃO: data-attr-name
            const block = document.querySelector(`.attr-block[data-attr-name="${atributoAlvoParaPericia}"] .attr-skills`);
            if(block) {
                // CORREÇÃO: removido o salvarFichaCompleta() da lixeira
                block.insertAdjacentHTML('beforeend', renderSkillRow(nome));
            }
            fecharModalNovaPericia();
        }

        // Permitir criar apertando Enter no input do modal
        document.getElementById('new-skill-name-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') confirmarNovaPericia();
            else if (e.key === 'Escape') fecharModalNovaPericia();
        });

        function getHpStateClass(hpPct) {
            if (hpPct > 50) return 'hp-state-good';
            if (hpPct > 20) return 'hp-state-warning';
            return 'hp-state-danger';
        }

        function installCharacterSheetDelegates() {
            if (window.characterSheetDelegatesReady) return;
            window.characterSheetDelegatesReady = true;

            document.addEventListener('click', (event) => {
                const skillDot = event.target.closest('.skill-dot[data-action="toggle-skill-dot"]');
                if (skillDot) {
                    toggleDot(skillDot);
                    return;
                }

                const skillDelete = event.target.closest('[data-action="delete-skill"]');
                if (skillDelete) {
                    skillDelete.closest('.skill-row')?.remove();
                    return;
                }

                const skillRoll = event.target.closest('[data-action="roll-skill"]');
                if (skillRoll) {
                    const row = skillRoll.closest('.skill-row');
                    rollFromSheet('1d20', getModPericia(row), skillRoll.textContent.trim(), 'pericia');
                    return;
                }

                const attrAdd = event.target.closest('[data-action="add-skill"]');
                if (attrAdd) {
                    addNovaPericiaInput(attrAdd.dataset.attrName);
                    return;
                }

                const attrRoll = event.target.closest('[data-action="roll-attr"]');
                if (attrRoll) {
                    rollFromSheet('1d20', getModAtributo(attrRoll.dataset.attrName), attrRoll.dataset.attrName, 'atributo');
                    return;
                }

                const deleteItem = event.target.closest('[data-action="delete-sheet-item"]');
                if (deleteItem) {
                    prepararDelecao(deleteItem);
                    return;
                }

                const equipmentRoll = event.target.closest('[data-action="equipment-roll"]');
                if (equipmentRoll) {
                    const mod = equipmentRoll.dataset.rollModAttr ? getModAtributo(equipmentRoll.dataset.rollModAttr) : 0;
                    rollFromSheet(equipmentRoll.dataset.rollDice, mod, equipmentRoll.dataset.rollLabel, equipmentRoll.dataset.rollType || 'arma');
                    return;
                }

                const sheetAction = event.target.closest('[data-sheet-action]');
                if (sheetAction) {
                    if (sheetAction.dataset.sheetAction === 'add-equipment') addEquipamento();
                    return;
                }

                if (event.target.closest('.roster-hp-input')) return;

                const rosterHp = event.target.closest('[data-roster-action="edit-hp"]');
                if (rosterHp) {
                    editarHPInline(event, rosterHp.dataset.characterId);
                    return;
                }

                const rosterAction = event.target.closest('[data-roster-action]');
                if (rosterAction) {
                    const id = rosterAction.dataset.characterId;
                    switch (rosterAction.dataset.rosterAction) {
                        case 'add-token':
                            if (window.phaserScene) window.phaserScene.adicionarToken(rosterAction.dataset.characterName, rosterAction.dataset.tokenPath || '', id);
                            break;
                        case 'edit':
                            abrirFicha(rosterAction.dataset.characterName, id);
                            break;
                        case 'clone':
                            duplicateCharacter(id);
                            break;
                        case 'visibility':
                            togglePlayerVisibility(id);
                            break;
                        case 'delete':
                            deletarPersonagemBanco(id);
                            break;
                    }
                    return;
                }

                const combatAction = event.target.closest('[data-combat-action]');
                if (combatAction) {
                    const id = combatAction.dataset.characterId;
                    switch (combatAction.dataset.combatAction) {
                        case 'close':
                            closeCombatSheet();
                            break;
                        case 'damage':
                            if (typeof window.openHpAdjustModal === 'function') window.openHpAdjustModal('damage', amount => applyDamage(id, amount));
                            else applyDamage(id, 1);
                            break;
                        case 'healing':
                            if (typeof window.openHpAdjustModal === 'function') window.openHpAdjustModal('healing', amount => applyHealing(id, amount));
                            else applyHealing(id, 1);
                            break;
                        case 'save':
                            salvarFichaCompleta(true);
                            break;
                        case 'roll-defense':
                            rollFromSheet('1d20', 0, `Defesa ${combatAction.dataset.label}`, 'atributo');
                            break;
                        case 'quick-action':
                            rollCharacterAction(id, parseInt(combatAction.dataset.actionIndex, 10));
                            break;
                        case 'condition':
                            toggleCondition(id, combatAction.dataset.conditionName);
                            break;
                    }
                }
            });

            document.addEventListener('input', (event) => {
                if (event.target.matches('.attr-value-input')) atualizarModAtributo(event.target);
                if (event.target.matches('.item-weight')) calcularPeso();
            });

            document.addEventListener('change', (event) => {
                if (event.target.matches('.combat-notes[data-character-id]')) {
                    const id = event.target.dataset.characterId;
                    if (fichasSalvas[id]) {
                        fichasSalvas[id].combatNotes = event.target.value;
                        salvarFichaCompleta(true);
                    }
                }
            });

            document.addEventListener('focusout', (event) => {
                if (event.target.matches('.roster-hp-input')) {
                    salvarHPInline(event.target, event.target.dataset.characterId);
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.target.matches('.roster-hp-input') && event.key === 'Enter') event.target.blur();
            });
        }

        installCharacterSheetDelegates();

        function toggleDot(elemento) {
            const parent = elemento.parentElement;
            const dots = Array.from(parent.children);
            const index = dots.indexOf(elemento);
            
            if (index === 0 && dots[0].classList.contains('filled') && !dots[1].classList.contains('filled')) {
                dots.forEach(d => d.classList.remove('filled'));
                return;
            }

            dots.forEach((d, i) => {
                if (i <= index) d.classList.add('filled');
                else d.classList.remove('filled');
            });
        }

        function switchSheetTab(tabId, btnElement) {
            // Remove 'active' de todos os botões e abas
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Adiciona 'active' no alvo
            btnElement.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        }

      let fichasSalvas = {};
        let pastasAtores = [{ id: 'default', nome: 'Atores', aberta: true }];
        
        // RECUPERA AS PASTAS DO NAVEGADOR
        try {
            const pastasSalvas = localStorage.getItem('cosmere_pastas_atores');
            if (pastasSalvas) pastasAtores = JSON.parse(pastasSalvas);
        } catch(e) {}

        let fichaAtualId = null;
        let tipoSeletorRetrato = 'portrait';

        function popularSelectPastas() {
            const select = document.getElementById('char-folder');
            if (!select) return;
            select.innerHTML = pastasAtores.map(p => `<option value="${p.id}">📁 Pasta: ${p.nome}</option>`).join('');
        }

        // ---------------------------------------------------------
        // RENDERIZAÇÃO DA LISTA DE TOKENS / ATORES
        // ---------------------------------------------------------
       function criarNovaPasta() {
            document.getElementById('new-folder-name-input').value = '';
            document.getElementById('create-folder-modal').classList.remove('hidden');
            document.getElementById('new-folder-name-input').focus();
        }

        function confirmarNovaPasta() {
            const nome = document.getElementById('new-folder-name-input').value.trim();
            if (nome) {
                pastasAtores.push({ id: 'folder_' + Date.now(), nome: nome, aberta: true });
                localStorage.setItem('cosmere_pastas_atores', JSON.stringify(pastasAtores)); // SALVA NO CACHE
                renderizarListaTokens();
                document.getElementById('create-folder-modal').classList.add('hidden');
                popularSelectPastas(); // Atualiza dropdown da ficha
            }
        }

        document.getElementById('new-folder-name-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') confirmarNovaPasta();
            else if (e.key === 'Escape') document.getElementById('create-folder-modal').classList.add('hidden');
        });

        function toggleFolder(folderId) {
            const folder = pastasAtores.find(p => p.id === folderId);
            if (folder) {
                folder.aberta = !folder.aberta;
                localStorage.setItem('cosmere_pastas_atores', JSON.stringify(pastasAtores));
                renderizarListaTokens();
            }
        }

       // ---------------------------------------------------------
        // CALCULADORA DE ATRIBUTOS DERIVADOS
        // ---------------------------------------------------------
        function calcularAtributosDerivados() {
            const getRawValue = (nomeAttr) => {
                const blocks = document.querySelectorAll('.attr-block');
                for (const block of blocks) {
                    if (block.dataset.attrName === nomeAttr) {
                        // Agora pega o número EXATO digitado na ficha (0, 1, 2, 3...)
                        return parseInt(block.querySelector('.attr-header input')?.value) || 0; 
                    }
                }
                return 0;
            };

            const lvlF = getRawValue('FORÇA');
            const lvlV = getRawValue('VELOCIDADE');
            const lvlW = getRawValue('VONTADE');
            const lvlC = getRawValue('CONSCIÊNCIA');
            const lvlP = getRawValue('PRESENÇA');

            const eCarga = document.getElementById('char-carga');
            if(eCarga && !eCarga.dataset.manual) {
                eCarga.value = lvlF <= 0 ? '50kg lev. / 25kg carga' : lvlF <= 2 ? '100kg lev. / 50kg carga' : lvlF <= 4 ? '250kg lev. / 125kg carga' : lvlF <= 6 ? '500kg lev. / 250kg carga' : lvlF <= 8 ? '2500kg lev. / 1250kg carga' : '5000kg lev. / 2500kg carga';
            }

            const eMov = document.getElementById('char-movimento');
            if(eMov && !eMov.dataset.manual) {
                eMov.value = lvlV <= 0 ? '6 metros' : lvlV <= 2 ? '7,5 metros' : lvlV <= 4 ? '9 metros' : lvlV <= 6 ? '12 metros' : lvlV <= 8 ? '18 metros' : '24 metros';
            }

            const eRec = document.getElementById('char-recuperacao');
            if(eRec && !eRec.dataset.manual) {
                eRec.value = lvlW <= 0 ? '1d4' : lvlW <= 2 ? '1d6' : lvlW <= 4 ? '1d8' : lvlW <= 6 ? '1d10' : lvlW <= 8 ? '1d12' : '1d20';
            }

            const eSen = document.getElementById('char-sentidos');
            if(eSen && !eSen.dataset.manual) {
                eSen.value = lvlC <= 0 ? '1.5m' : lvlC <= 2 ? '3m' : lvlC <= 4 ? '6m' : lvlC <= 6 ? '15m' : lvlC <= 8 ? '30m' : 'Ilimitado (Não Afetado)';
            }

            const eCon = document.getElementById('char-conexoes-deriv');
            if(eCon && !eCon.dataset.manual) {
                eCon.value = lvlP <= 0 ? '1 ano' : lvlP <= 2 ? '50 dias' : lvlP <= 4 ? '5 dias' : lvlP <= 6 ? '1 dia' : lvlP <= 8 ? '1 hora' : 'Imediata';
            }
        }

        function renderizarListaTokens() {
            const container = document.getElementById('token-list');
            const termoBusca = document.getElementById('search-actor').value.toLowerCase();
            const tipoFiltro = document.getElementById('filter-actor-type').value;
            const fichasEntries = Object.entries(fichasSalvas);
            const atoresFiltrados = fichasEntries.filter(([id, ficha]) => {
                const nome = ficha.nome || '';
                const matchBusca = termoBusca === '' || nome.toLowerCase().includes(termoBusca);
                const matchTipo = tipoFiltro === 'all' || ficha.type === tipoFiltro || (!ficha.type && tipoFiltro === 'PC');
                return matchBusca && matchTipo;
            });

            container.innerHTML = '';
            container.insertAdjacentHTML('beforeend', `
                <div class="vtt-library-overview actor-library-overview">
                    <span class="vtt-library-overview__icon"><i class="fas fa-users"></i></span>
                    <span class="vtt-library-overview__copy">
                        <strong>Fichas e tokens</strong>
                        <small>${atoresFiltrados.length} visiveis de ${fichasEntries.length} cadastradas</small>
                    </span>
                    <span class="vtt-library-overview__count">${atoresFiltrados.length}</span>
                </div>
            `);

            let renderedActors = 0;

            pastasAtores.forEach(pasta => {
                const atoresNaPasta = fichasEntries.filter(([id, ficha]) => {
                    const matchPasta = (ficha.folderId || 'default') === pasta.id;
                    const nome = ficha.nome || '';
                    const matchBusca = termoBusca === '' || nome.toLowerCase().includes(termoBusca);
                    const matchTipo = tipoFiltro === 'all' || ficha.type === tipoFiltro || (!ficha.type && tipoFiltro === 'PC');
                    return matchPasta && matchBusca && matchTipo;
                });

                if (atoresNaPasta.length === 0 && termoBusca !== '') return;

                const header = document.createElement('div');
                header.className = 'category-header actor-folder-header';
                header.innerHTML = `
                    <strong><i class="fas fa-folder${pasta.aberta ? '-open' : ''} category-header__icon"></i> ${escapeSheetHtml(pasta.nome)}</strong>
                    <span>${atoresNaPasta.length}</span>
                `;
                header.onclick = () => toggleFolder(pasta.id);
                container.appendChild(header);

                if (pasta.aberta) {
                    const grid = document.createElement('div');
                    grid.className = 'roster-grid';
                    
                    atoresNaPasta.forEach(([id, ficha]) => {
                        const card = document.createElement('div');
                        card.className = 'roster-card';
                        card.draggable = true;
                        card.ondragstart = (e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({ id: id, nome: ficha.nome, tokenPath: ficha.tokenPath || ficha.portraitPath }));
                        };

                        const hpPct = ficha.hpMax > 0 ? (ficha.hpAtual / ficha.hpMax) * 100 : 0;
                        const hpStateClass = getHpStateClass(hpPct);
                        const eyeIcon = ficha.isVisibleToPlayers ? 'fa-eye' : 'fa-eye-slash';
                        const eyeColor = ficha.isVisibleToPlayers ? '#22c55e' : '#94a3b8';
                        const visibilityClass = ficha.isVisibleToPlayers ? 'is-visible' : 'is-hidden';
                        const visibilityLabel = ficha.isVisibleToPlayers ? 'Visivel' : 'Oculto';
                        const visibilityTitle = ficha.isVisibleToPlayers ? 'Visivel para jogadores' : 'Oculto dos jogadores';
                        const safeId = escapeSheetHtml(id);
                        const safeName = escapeSheetHtml(ficha.nome);
                        const safeTrilha = escapeSheetHtml(ficha.trilha || 'Nenhuma Trilha');
                        const safeTokenPath = escapeSheetHtml((ficha.tokenPath || ficha.portraitPath || '').replace(/\\/g, '/'));

                        card.innerHTML = `
                            <img class="roster-img" src="file://${escapeSheetHtml(ficha.portraitPath || '')}" onerror="this.src='../assets/persons/default.png'">

                            <button class="roster-visibility-toggle ${visibilityClass}" data-roster-action="visibility" data-character-id="${safeId}" title="${visibilityTitle}" aria-label="${visibilityTitle}" aria-pressed="${ficha.isVisibleToPlayers ? 'true' : 'false'}" style="--roster-visibility-color: ${eyeColor}">
                                <i class="fas ${eyeIcon}"></i>
                                <span>${visibilityLabel}</span>
                            </button>
                            
                            <div class="roster-info">
                                <div class="roster-name">${safeName}</div>
                                <div class="roster-class">${safeTrilha}</div>
                                <div class="roster-hp-row">
                                    <div class="roster-hp-text ${hpStateClass}" data-roster-action="edit-hp" data-character-id="${safeId}" title="Clique para editar HP">${ficha.hpAtual}/${ficha.hpMax}</div>
                                </div>
                                <div class="roster-hp-bar"><div class="roster-hp-fill ${hpStateClass}"></div></div>
                            </div>

                            <div class="roster-actions">
                                <button class="roster-btn add-token" data-roster-action="add-token" data-character-id="${safeId}" data-character-name="${safeName}" data-token-path="${safeTokenPath}" title="Adicionar ao Mapa"><i class="fas fa-map-marker-alt"></i></button>
                                <button class="roster-btn edit" data-roster-action="edit" data-character-id="${safeId}" data-character-name="${safeName}" title="Editar Ficha"><i class="fas fa-edit"></i></button>
                                <button class="roster-btn spawn" data-roster-action="clone" data-character-id="${safeId}" title="Clonar Ator"><i class="fas fa-clone"></i></button>
                                <button class="roster-btn delete" data-roster-action="delete" data-character-id="${safeId}" title="Deletar"><i class="fas fa-trash"></i></button>
                            </div>
                        `;
                        const rosterImg = card.querySelector('.roster-img');
                        if (rosterImg) rosterImg.style.objectPosition = ficha.portraitPos || '50% 50%';
                        const hpFill = card.querySelector('.roster-hp-fill');
                        if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;

                        grid.appendChild(card);
                        renderedActors++;
                    });

                    if (atoresNaPasta.length === 0) {
                        grid.innerHTML = `
                            <div class="vtt-empty-state vtt-empty-state--library">
                                <i class="fas fa-user-slash"></i>
                                <span>Nenhuma ficha nesta pasta.</span>
                            </div>
                        `;
                    }
                    container.appendChild(grid);
                }
            });

            if (renderedActors === 0 && atoresFiltrados.length === 0) {
                container.insertAdjacentHTML('beforeend', `
                    <div class="vtt-empty-state vtt-empty-state--library">
                        <i class="fas fa-magnifying-glass"></i>
                        <span>Nenhuma ficha encontrada para este filtro.</span>
                    </div>
                `);
            }
        }

        function editarHPInline(e, id) {
            e.stopPropagation();
            const div = e.target;
            div.innerHTML = `<input type="number" class="roster-hp-input" data-character-id="${escapeSheetHtml(id)}" value="${fichasSalvas[id].hpAtual}">`;
            const input = div.querySelector('input');
            input.focus();
            input.select();
        }

        function salvarHPInline(input, id) {
            const novoHP = parseInt(input.value) || 0;
            fichasSalvas[id].hpAtual = novoHP;
            
            if (window.api) window.api.saveCharacter(id, JSON.stringify(fichasSalvas[id]));
            if (window.phaserScene) window.phaserScene.updateTokenHP(id, novoHP, fichasSalvas[id].hpMax);
            
            renderizarListaTokens();
        }

        function togglePlayerVisibility(id) {
            if (fichasSalvas[id]) {
                fichasSalvas[id].isVisibleToPlayers = !fichasSalvas[id].isVisibleToPlayers;
                if (window.api) {
                    window.api.saveCharacter(id, JSON.stringify(fichasSalvas[id]));
                    if (window.api.syncBoard) window.api.syncBoard({ type: 'update-permissions', charId: id, visible: fichasSalvas[id].isVisibleToPlayers });
                }
                renderizarListaTokens();
            }
        }

        // Ao abrir o app
        window.addEventListener('DOMContentLoaded', async () => {
            // CARGA CRÍTICA: Recupera todas as fichas do banco ao iniciar
            if(window.api && window.api.getCharacters) {
                const dadosBrutos = await window.api.getCharacters();
                // Se a API retornar um objeto com strings JSON, precisamos converter
                for (let id in dadosBrutos) {
                    try {
                        fichasSalvas[id] = typeof dadosBrutos[id] === 'string' ? JSON.parse(dadosBrutos[id]) : dadosBrutos[id];
                        
                        // Fallbacks de migração para fichas antigas
                        if (!fichasSalvas[id].folderId) fichasSalvas[id].folderId = 'default';
                        if (fichasSalvas[id].isVisibleToPlayers === undefined) fichasSalvas[id].isVisibleToPlayers = true;
                        if (!fichasSalvas[id].type) fichasSalvas[id].type = 'PC';
                        
                    } catch(e) {
                        fichasSalvas[id] = dadosBrutos[id];
                    }
                }
                renderizarListaTokens();
            }

            const introDiv = document.getElementById('intro-cinematic');
            const introVid = document.getElementById('intro-video');

            if (introVid && introDiv) {
                // Quando o vídeo acabar, remove a camada de intro
                introVid.onended = finalizarIntro;
                
                // Atalho ESC para pular a intro
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !introDiv.classList.contains('hidden')) {
                        finalizarIntro();
                    }
                });
            }
        });
        

        function finalizarIntro() {
            const introDiv = document.getElementById('intro-cinematic');
            const introVid = document.getElementById('intro-video');
            if (introDiv.classList.contains('hidden')) return;
            
            introVid.pause();
            introDiv.style.opacity = '0';
            setTimeout(() => {
                introDiv.classList.add('hidden');
                addChatMessage("Sistema", "A jornada começa agora...", "#fbbf24");
            }, 1000);
        }

        function abrirFicha(nomeDoToken, idUnico) {
            fichaAtualId = idUnico || nomeDoToken;

            if (!fichasSalvas[fichaAtualId]) {
                fichasSalvas[fichaAtualId] = {
                    nome: nomeDoToken, hpMax: 10, hpAtual: 10,
                    equipamentos: [], talentos: [], conexoes: [],
                    ideal: '', falha: '', diario: '', armadura: '', deflexao: ''
                };
            }

            const ficha = fichasSalvas[fichaAtualId];

            // Setar Valores Simples
            document.getElementById('char-name').value = ficha.nome || '';
            document.getElementById('hp-atual-input').value = ficha.hpAtual || 10;
            document.getElementById('hp-max-input').value = ficha.hpMax || 10;
            atualizarHPSalvo(); 
            document.getElementById('char-armor').value = ficha.armadura || '';
            document.getElementById('char-deflection').value = ficha.deflexao || '';
            document.querySelector('.ideal-banner input').value = ficha.ideal || '';
            document.querySelector('.flaw-banner input').value = ficha.falha || '';
            document.querySelector('.journal-wrapper textarea').value = ficha.diario || '';

            // CARREGA A PASTA SALVA
            popularSelectPastas();
            const folderSelect = document.getElementById('char-folder');
            if (folderSelect && ficha.folderId) folderSelect.value = ficha.folderId;
            else if (folderSelect) folderSelect.value = 'default';

            // CARREGA OS IDIOMAS E DERIVADOS
            document.getElementById('char-idiomas').value = ficha.idiomas || '';
            
            const setDeriv = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = val || '';
                    if (val) el.dataset.manual = "true"; // Se existe no banco, é pq o GM fez override.
                    else delete el.dataset.manual; // Senão, deixa o auto-cálculo fazer.
                }
            };
            setDeriv('char-carga', ficha.carga);
            setDeriv('char-movimento', ficha.movimento);
            setDeriv('char-recuperacao', ficha.recuperacao);
            setDeriv('char-sentidos', ficha.sentidos);
            setDeriv('char-conexoes-deriv', ficha.conexoesDeriv);

            const gmNotes = document.getElementById('char-gm-notes');
            if(gmNotes) gmNotes.value = ficha.anotacoesGM || '';

            // Carregar dados de Magia
            if (ficha.oaths && ficha.oaths.length) {
                for (let i = 0; i < 5; i++) {
                    const oathEl = document.getElementById(`magic-oath${i+1}`);
                    if (oathEl) oathEl.value = ficha.oaths[i] || '';
                }
            }
            if (document.getElementById('magic-spheres')) document.getElementById('magic-spheres').value = ficha.spheres || 0;
            if (document.getElementById('magic-sphere-charge')) document.getElementById('magic-sphere-charge').value = ficha.sphereCharge || 100;
            if (document.getElementById('magic-sphere-type')) document.getElementById('magic-sphere-type').value = ficha.sphereType || '';

            // Carregar Topo da Aba de Status
            const inputsStatus = document.querySelectorAll('#tab-stats .char-card input');
            if (inputsStatus.length >= 6) {
                inputsStatus[0].value = ficha.ancestralidade || '';
                inputsStatus[1].value = ficha.trilha || '';
                inputsStatus[2].value = ficha.nivel || '1';
                inputsStatus[3].value = ficha.defFisico || '10';
                inputsStatus[4].value = ficha.defCognitivo || '10';
                inputsStatus[5].value = ficha.defEspiritual || '10';
            }

            // RECONSTRUÇÃO TOTAL DAS PERÍCIAS (Garante as 9 bolinhas e salva as criadas)
            const container = document.getElementById('dynamic-skills-container');
            container.innerHTML = '';
            
            const listaAtributos = (ficha.atributos && ficha.atributos.length > 0) ? ficha.atributos : atributos_rpg.map(a => ({ nome: a.nome, valor: 10, pericias: a.pericias.map(p => ({name: p, rank: 0})) }));

            listaAtributos.forEach(attr => {
                const attrBase = atributos_rpg.find(a => a.nome === attr.nome);
                const classeAttr = attrBase ? attrBase.classe : 'card-fisico';
                let pHTML = (attr.pericias || []).map(p => {
                    // CORREÇÃO: removido o salvarFichaCompleta() da lixeira
return renderSkillRow(p.name, p.rank, true);
                }).join('');

container.innerHTML += `
    <div class="attr-block ${classeAttr}" data-attr-name="${attr.nome}">
        ${renderAttrHeader(attr.nome, attr.valor || 10, true)}
        <div class="attr-skills">${pHTML}</div>
    </div>`;    
    });
    

            // Renderizar Equipamentos Salvos
            const equipCont = document.getElementById('equipment-container');
            equipCont.innerHTML = '';
            (ficha.equipamentos || []).forEach(e => {
                const div = document.createElement('div');
                div.className = 'char-card card-fisico slot-weapon';
                // Extrai o dado do campo desc (ex: "1d8 + Força" → "1d8", mod → 0)
                const diceMatch = (e.desc || '').match(/(\d+d\d+)/i);
                const diceNotation = diceMatch ? diceMatch[1] : '1d6';
                const nomeArma = e.nome || e.label || 'Arma';
                const safeNomeArma = escapeSheetHtml(nomeArma);

                div.innerHTML = `
                    <button type="button" class="btn-delete-item" data-action="delete-sheet-item"><i class="fas fa-trash"></i></button>
                    <label>${escapeSheetHtml(e.label)}</label>
                    <input type="text" value="${escapeSheetHtml(e.nome)}" class="item-name">
                    <div class="slot-desc"><input type="text" value="${escapeSheetHtml(e.desc)}" class="slot-desc-input"></div>
                    <div class="slot-roll-bar">
                        <button type="button" data-action="equipment-roll" data-roll-dice="${escapeSheetHtml(diceNotation)}" data-roll-mod-attr="FORÇA" data-roll-label="${safeNomeArma}" data-roll-type="arma" title="Rolar dano">
                            ⚔ ${diceNotation}+FOR
                        </button>
                        <button type="button" data-action="equipment-roll" data-roll-dice="1d20" data-roll-mod-attr="VELOCIDADE" data-roll-label="Ataque — ${safeNomeArma}" data-roll-type="arma" title="Rolar ataque">
                            🎯 Ataque
                        </button>
                    </div>
                `;
                equipCont.appendChild(div);
            });

            // Renderizar Talentos Salvos
            const talentCont = document.getElementById('talents-container');
            talentCont.innerHTML = '';
            (ficha.talentos || []).forEach(t => {
                const div = document.createElement('div');
                div.className = 'talent-card card-trilha';
                div.innerHTML = `
                    <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                    <div class="talent-header"><input type="text" value="${t.nome}" class="talent-name"><i class="fas fa-star"></i></div>
                    <textarea>${t.descricao}</textarea>
                `;
                talentCont.appendChild(div);
            });

            // Renderizar Conexões Salvas
            const connCont = document.getElementById('connections-container');
            connCont.innerHTML = '';
            (ficha.conexoes || []).forEach(c => {
                const div = document.createElement('div');
                div.className = 'connection-medal';
                div.innerHTML = `
                    <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                    <div class="medal-circle"><i class="fas fa-user"></i></div>
                    <input type="text" value="${c.nome}" class="conn-name">
                    <input type="text" class="medal-desc conn-desc" value="${c.desc}">
                `;
                connCont.appendChild(div);
            });
            
            // Carrega a foto associada ou tenta o padrão .png na pasta correta
            const portraitImg = document.getElementById('char-portrait');
            portraitImg.src = ficha.portraitPath ? `file://${ficha.portraitPath}` : `../assets/persons/${ficha.nome}.png`;
            portraitImg.style.objectPosition = ficha.portraitPos || '50% 50%'; 
            portraitImg.style.transform = `scale(${ficha.portraitScale || 1})`; 
            currentScale = ficha.portraitScale || 1;
            
            const tokenImg = document.getElementById('char-token-img');
            tokenImg.src = ficha.tokenPath ? `file://${ficha.tokenPath}` : portraitImg.src;
            
            // Tipo de ator
            const tipoSelect = document.getElementById('char-type');
            if (tipoSelect && ficha.type) tipoSelect.value = ficha.type;
            
            document.getElementById('char-sheet-modal').classList.remove('hidden');
            
            // Roda o cálculo depois que tudo gerou pra não dar delay
            setTimeout(calcularAtributosDerivados, 50);
        }

       function fecharFicha() {
            document.getElementById('char-sheet-modal').classList.add('hidden');
            salvarFichaCompleta(); // Extrai todos os dados do HTML antes de fechar
            // Auto-Save ao fechar a ficha
            if (fichaAtualId && window.api) {
                window.api.saveCharacter(fichaAtualId, JSON.stringify(fichasSalvas[fichaAtualId]));
            }
        }

        function getCombatSheetModal() {
            let modal = document.getElementById('combat-sheet-modal');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'combat-sheet-modal';
            modal.className = 'hidden';
            modal.innerHTML = '<div id="combat-sheet-root" class="combat-sheet"></div>';
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeCombatSheet();
            });
            document.body.appendChild(modal);
            return modal;
        }

        function getCurrentCombatCharacter(characterId) {
            const id = characterId || fichaAtualId;
            if (!id || !fichasSalvas[id]) return null;
            return { id, ficha: fichasSalvas[id] };
        }

        function openCombatSheet(characterId) {
            const current = getCurrentCombatCharacter(characterId);
            if (!current) {
                if (typeof mostrarToast === 'function') mostrarToast('Abra uma ficha antes de usar o modo combate.', 'warning');
                return;
            }
            fichaAtualId = current.id;
            const modal = getCombatSheetModal();
            renderCombatSheet(current.ficha);
            modal.classList.remove('hidden');
        }

        function closeCombatSheet() {
            const modal = document.getElementById('combat-sheet-modal');
            if (modal) modal.classList.add('hidden');
        }

        function normalizeSheetConditions(ficha) {
            if (!Array.isArray(ficha.conditions)) ficha.conditions = [];
            return ficha.conditions;
        }

        function renderCombatSheet(character) {
            const current = getCurrentCombatCharacter();
            if (!current) return;
            const ficha = character || current.ficha;
            const root = document.getElementById('combat-sheet-root') || getCombatSheetModal().querySelector('#combat-sheet-root');
            const hpAtual = parseInt(ficha.hpAtual) || 0;
            const hpMax = parseInt(ficha.hpMax) || 0;
            const hpPct = hpMax > 0 ? Math.max(0, Math.min(100, Math.round((hpAtual / hpMax) * 100))) : 0;
            const portrait = ficha.portraitPath ? `file://${ficha.portraitPath}` : (ficha.tokenPath ? `file://${ficha.tokenPath}` : '../assets/persons/default.png');
            const conditions = normalizeSheetConditions(ficha);
            const defenses = [
                ['Fisico', document.querySelectorAll('#tab-stats .char-card input')[3]?.value || ficha.defFisico || '10'],
                ['Cognitivo', document.querySelectorAll('#tab-stats .char-card input')[4]?.value || ficha.defCognitivo || '10'],
                ['Espiritual', document.querySelectorAll('#tab-stats .char-card input')[5]?.value || ficha.defEspiritual || '10']
            ];
            const quickActions = (ficha.equipamentos || []).slice(0, 4);
            const safeCharacterId = escapeSheetHtml(current.id);

            root.innerHTML = `
                <div class="combat-sheet__header">
                    <img class="combat-sheet__portrait" src="${escapeSheetHtml(portrait)}" alt="">
                    <div>
                        <h2 class="combat-sheet__name">${escapeSheetHtml(ficha.nome || 'Personagem')}</h2>
                        <div class="combat-sheet__meta">${escapeSheetHtml(ficha.type || 'PC')} ${ficha.trilha ? ' / ' + escapeSheetHtml(ficha.trilha) : ''}</div>
                    </div>
                    <button type="button" class="ui-icon-btn" data-combat-action="close" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
                <div class="combat-sheet__body">
                    <div class="combat-hp">
                        <div class="combat-hp__row">
                            <span>HP</span>
                            <strong>${hpAtual} / ${hpMax}</strong>
                        </div>
                        <div class="combat-hp__bar"><div class="combat-hp__fill"></div></div>
                        <div class="combat-actions">
                            <button type="button" class="ui-btn ui-btn--danger" data-combat-action="damage" data-character-id="${safeCharacterId}"><i class="fas fa-minus"></i> Dano</button>
                            <button type="button" class="ui-btn" data-combat-action="healing" data-character-id="${safeCharacterId}"><i class="fas fa-plus"></i> Cura</button>
                            <button type="button" class="ui-btn ui-btn--primary" data-combat-action="save" data-character-id="${safeCharacterId}"><i class="fas fa-save"></i> Salvar</button>
                        </div>
                    </div>

                    <div class="combat-quick-grid">
                        ${defenses.map(([label, value]) => `
                            <button type="button" class="combat-stat" data-combat-action="roll-defense" data-label="${escapeSheetHtml(label)}">
                                <span class="combat-stat__label">${escapeSheetHtml(label)}</span>
                                <span class="combat-stat__value">${escapeSheetHtml(value)}</span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="combat-section">
                        <div class="combat-section__title">Acoes rapidas</div>
                        <div class="combat-action-list">
                            ${quickActions.length ? quickActions.map((item, index) => `
                                <button type="button" class="ui-btn ui-btn--ghost" data-combat-action="quick-action" data-character-id="${safeCharacterId}" data-action-index="${index}">
                                    <i class="fas fa-dice-d20"></i> ${escapeSheetHtml(item.nome || item.name || 'Acao')}
                                </button>
                            `).join('') : '<span class="combat-empty">Sem equipamentos cadastrados.</span>'}
                        </div>
                    </div>

                    <div class="combat-section">
                        <div class="combat-section__title">Condicoes</div>
                        <div class="combat-conditions">
                            ${['Abalado', 'Ferido', 'Caido', 'Marcado', 'Invisivel'].map(name => `
                                <button type="button" class="combat-condition ${conditions.some(c => c.name === name) ? 'is-active' : ''}" data-combat-action="condition" data-character-id="${safeCharacterId}" data-condition-name="${escapeSheetHtml(name)}">${escapeSheetHtml(name)}</button>
                            `).join('')}
                        </div>
                    </div>

                    <textarea class="combat-notes" data-character-id="${safeCharacterId}" placeholder="Notas rapidas de combate">${escapeSheetHtml(ficha.combatNotes || '')}</textarea>
                </div>
            `;
            const hpFill = root.querySelector('.combat-hp__fill');
            if (hpFill) hpFill.style.width = `${hpPct}%`;
        }

        function persistCombatCharacter(characterId) {
            if (!characterId || !fichasSalvas[characterId]) return;
            if (window.api) window.api.saveCharacter(characterId, JSON.stringify(fichasSalvas[characterId]));
            if (window.phaserScene) window.phaserScene.updateTokenHP(characterId, fichasSalvas[characterId].hpAtual, fichasSalvas[characterId].hpMax);
            window.fichasSalvas = fichasSalvas;
            renderizarListaTokens();
        }

        function applyDamage(characterId, amount) {
            const value = Math.max(0, parseInt(amount) || 0);
            if (!value || !fichasSalvas[characterId]) return;
            fichasSalvas[characterId].hpAtual = Math.max(0, (parseInt(fichasSalvas[characterId].hpAtual) || 0) - value);
            persistCombatCharacter(characterId);
            renderCombatSheet(fichasSalvas[characterId]);
            addChatMessage('Sistema', `${fichasSalvas[characterId].nome || 'Personagem'} recebeu ${value} de dano.`, '#ef4444');
        }

        function applyHealing(characterId, amount) {
            const value = Math.max(0, parseInt(amount) || 0);
            if (!value || !fichasSalvas[characterId]) return;
            const hpMax = parseInt(fichasSalvas[characterId].hpMax) || 0;
            fichasSalvas[characterId].hpAtual = Math.min(hpMax, (parseInt(fichasSalvas[characterId].hpAtual) || 0) + value);
            persistCombatCharacter(characterId);
            renderCombatSheet(fichasSalvas[characterId]);
            addChatMessage('Sistema', `${fichasSalvas[characterId].nome || 'Personagem'} recuperou ${value} de HP.`, '#22c55e');
        }

        function toggleCondition(characterId, condition) {
            if (!fichasSalvas[characterId]) return;
            const conditions = normalizeSheetConditions(fichasSalvas[characterId]);
            const existing = conditions.findIndex(c => c.name === condition);
            if (existing >= 0) conditions.splice(existing, 1);
            else conditions.push({ id: `cond_${Date.now()}`, name: condition, icon: '', color: '#fbbf24', durationType: 'custom', remaining: null, description: '' });
            const token = window.phaserScene?.camadaTokens?.list?.find(t => t.tokenId === characterId);
            if (token) {
                token.conditions = conditions.map(c => c.name || c).filter(Boolean);
                window.phaserScene.renderTokenConditions?.(token);
            }
            const participant = window.combatState?.participants?.find(p => p.id === characterId);
            if (participant) participant.conditions = conditions.map(c => c.name || c).filter(Boolean);
            persistCombatCharacter(characterId);
            renderCombatSheet(fichasSalvas[characterId]);
        }

        function rollCharacterAction(characterId, actionId) {
            const ficha = fichasSalvas[characterId];
            if (!ficha) return;
            const item = (ficha.equipamentos || [])[actionId];
            if (!item) return;
            const name = item.nome || item.name || 'Acao';
            const notation = item.dado || item.dice || '1d20';
            rollFromSheet(notation, 0, name, 'arma');
        }

        // --- SISTEMA DINÂMICO E SALVAMENTO ---

        let elementoParaDeletar = null;
        let atorParaDeletarId = null;

        function prepararDelecao(btnElement) {
            elementoParaDeletar = btnElement.parentElement;
            atorParaDeletarId = null;
            document.getElementById('delete-confirm-modal').classList.remove('hidden');
        }

        // Sobrescrevendo a função para usar o Modal ao invés do "confirm" nativo
        function deletarPersonagemBanco(charId) {
            atorParaDeletarId = charId;
            elementoParaDeletar = null;
            document.getElementById('delete-confirm-modal').querySelector('p').innerText = "Você está prestes a apagar este personagem inteiramente do banco de dados.";
            document.getElementById('delete-confirm-modal').classList.remove('hidden');
        }

        function executarDelecao() {
            if (atorParaDeletarId) {
                // Deletar Personagem Inteiro
                if (window.api && window.api.deleteCharacter) window.api.deleteCharacter(atorParaDeletarId);
                if (fichasSalvas[atorParaDeletarId]) delete fichasSalvas[atorParaDeletarId];
                renderizarListaTokens();
                mostrarToast('Personagem deletado permanentemente.', 'danger', 'fa-trash');
                
            } else if (elementoParaDeletar) {
                // Deletar item de dentro da ficha
                elementoParaDeletar.remove();
                salvarFichaCompleta();
            }
            
            atorParaDeletarId = null;
            elementoParaDeletar = null;
            document.getElementById('delete-confirm-modal').classList.add('hidden');
        }

        let atorParaClonarId = null;

        function duplicateCharacter(id) {
            atorParaClonarId = id;
            document.getElementById('clone-confirm-modal').classList.remove('hidden');
        }

        function executarClone() {
            if (!atorParaClonarId) return;
            const origin = fichasSalvas[atorParaClonarId];
            if (!origin) return;
            
            const novoId = "char_" + Date.now();
            const clone = JSON.parse(JSON.stringify(origin));
            clone.nome = clone.nome + " (Cópia)";
            
            fichasSalvas[novoId] = clone;
            if (window.api) window.api.saveCharacter(novoId, JSON.stringify(clone));
            renderizarListaTokens();
            mostrarToast(`Personagem <b>${clone.nome}</b> clonado com sucesso!`, 'success', 'fa-clone');
            
            document.getElementById('clone-confirm-modal').classList.add('hidden');
            atorParaClonarId = null;
        }

        function addEquipamento() {
            const container = document.getElementById('equipment-container');
            const div = document.createElement('div');
            div.className = 'char-card card-fisico slot-weapon';
            div.innerHTML = `
                <button type="button" class="btn-delete-item" data-action="delete-sheet-item"><i class="fas fa-trash"></i></button>
                <label><i class="fas fa-box"></i> Slot Novo</label>
                <input type="text" placeholder="Nome do Item" class="item-name">
                <input type="number" class="item-weight" placeholder="Peso" min="0" step="0.1">
                <div class="slot-desc"><input type="text" class="slot-desc-input" placeholder="Dano/Efeito"></div>
            `;
            container.appendChild(div);
        }

        function calcularPeso() {
            const weights = document.querySelectorAll('.item-weight');
            let total = 0;
            weights.forEach(w => { total += parseFloat(w.value) || 0; });
            const display = document.getElementById('peso-total-display');
            if (display) display.textContent = `Peso Total: ${total.toFixed(1)}`;
        }

        function addTalento() {
            const container = document.getElementById('talents-container');
            const div = document.createElement('div');
            div.className = 'talent-card card-trilha';
            div.innerHTML = `
                <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                <div class="talent-header">
                    <input type="text" placeholder="Novo Talento" class="talent-name">
                    <i class="fas fa-star"></i>
                </div>
                <textarea placeholder="Descreva o efeito mecânico..."></textarea>
            `;
            container.appendChild(div);
        }

        function addConexao() {
            const container = document.getElementById('connections-container');
            const div = document.createElement('div');
            div.className = 'connection-medal';
            div.innerHTML = `
                <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                <div class="medal-circle"><i class="fas fa-user"></i></div>
                <input type="text" placeholder="Nome do Aliado" class="conn-name">
                <input type="text" class="medal-desc conn-desc" placeholder="Relação / Dívida">
            `;
            container.appendChild(div);
        }

        function addLashing() {
            const container = document.getElementById('lashings-container');
            const div = document.createElement('div');
            div.className = 'talent-card card-trilha';
            div.innerHTML = `
                <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                <div class="talent-header">
                    <input type="text" placeholder="Nome do Lashing">
                    <i class="fas fa-magic"></i>
                </div>
                <textarea placeholder="Descreva: direção, intensidade, duração..."></textarea>
            `;
            container.appendChild(div);
        }

        // Substituído para usar o novo Toast padronizado
        function mostrarAvisoSalvo() {
            mostrarToast("Ficha atualizada com sucesso!");
        }

       async function abrirSeletorRetrato(tipo = 'portrait') {
            tipoSeletorRetrato = tipo;
            
            // Aqui está o pulo do gato: usamos as APIs separadas que JÁ EXISTEM no seu Main.js
            const imagens = tipo === 'token' ? await window.api.getTokens() : await window.api.getPortraits();
            
            const grid = document.getElementById('portrait-grid');
            grid.innerHTML = imagens.map(p => `
                <div onclick="vincularRetrato('${p.path.replace(/\\/g, '/')}')" style="cursor:pointer; border:1px solid rgba(255,255,255,0.1); border-radius:8px; overflow:hidden; background:#000; text-align:center; transition:0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
                    <img src="file://${p.path}" style="width:100%; aspect-ratio:1; object-fit:cover;">
                    <div style="padding:5px; font-size:10px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                </div>
            `).join('');
            document.getElementById('portrait-selector-modal').classList.remove('hidden');
        }

        // Abrir modal de criação
        function criarNovoPersonagem() {
            document.getElementById('new-char-name-input').value = ''; // Limpa o input
            document.getElementById('create-char-modal').classList.remove('hidden');
            document.getElementById('new-char-name-input').focus();
        }

        // Fechar modal de criação
        function fecharModalCriacao() {
            document.getElementById('create-char-modal').classList.add('hidden');
        }

        // Confirmar e criar a ficha
        function confirmarCriacaoPersonagem() {
            const nomeInput = document.getElementById('new-char-name-input');
            const nome = nomeInput.value.trim();
            
            if (!nome || nome === "") {
                // Efeito visual simples se tentar criar sem nome
                nomeInput.style.borderColor = "#ef4444";
                setTimeout(() => nomeInput.style.borderColor = "rgba(255,255,255,0.1)", 1000);
                return;
            }

            const idNovo = "char_" + Date.now();
            fichasSalvas[idNovo] = { 
                nome: nome, hpMax: 10, hpAtual: 10, 
                equipamentos: [], talentos: [], conexoes: [],
                ideal: '', falha: '', diario: '', armadura: '', deflexao: ''
            };

            // Salva no banco imediatamente
            if(window.api) window.api.saveCharacter(idNovo, JSON.stringify(fichasSalvas[idNovo]));
            
            fecharModalCriacao();
            
            // Abre a ficha nova
            abrirFicha(nome, idNovo);
            addChatMessage("Sistema", `Ficha de <strong>${nome}</strong> criada com sucesso.`, "#fbbf24");
            
            // Atualiza a barra lateral (Tokens) se necessário
            if(window.phaserScene) window.phaserScene.refreshLibrary();
        }

        // Permitir criar apertando Enter no input do modal
        document.getElementById('new-char-name-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                confirmarCriacaoPersonagem();
            } else if (e.key === 'Escape') {
                fecharModalCriacao();
            }
        });

       function salvarFichaCompleta(mostrarAviso = false) {
            if (!fichaAtualId) return;

            if (!fichasSalvas[fichaAtualId]) {
                fichasSalvas[fichaAtualId] = {};
            }

            const ficha = fichasSalvas[fichaAtualId];

            // 1. Dados Básicos, Defesas e Retrato
            ficha.nome = document.getElementById('char-name').value;
            ficha.hpMax = parseInt(document.getElementById('hp-max-input').value) || 10;
            ficha.hpAtual = parseInt(document.getElementById('hp-atual-input').value) || 10;
            ficha.armadura = document.getElementById('char-armor').value;
            ficha.deflexao = document.getElementById('char-deflection').value;
            ficha.portraitPath = document.getElementById('char-portrait').src.replace('file://', '');
            ficha.portraitPos = document.getElementById('char-portrait').style.objectPosition || '50% 50%'; 
            const currentTransform = document.getElementById('char-portrait').style.transform;
            ficha.portraitScale = currentTransform.includes('scale') ? parseFloat(currentTransform.replace(/[^\d.]/g, '')) : 1;
            ficha.tokenPath = document.getElementById('char-token-img').src.replace('file://', '');
            
            const tipoSelect = document.getElementById('char-type');
            if (tipoSelect) ficha.type = tipoSelect.value;

            // O dropdown da pasta
            const folderSelect = document.getElementById('char-folder');
            if (folderSelect) ficha.folderId = folderSelect.value;

            // Idiomas e Derivados (salva a string vazia se foi automático, pra forçar recalcular na próxima)
            ficha.idiomas = document.getElementById('char-idiomas').value;
            ficha.carga = document.getElementById('char-carga').dataset.manual ? document.getElementById('char-carga').value : '';
            ficha.movimento = document.getElementById('char-movimento').dataset.manual ? document.getElementById('char-movimento').value : '';
            ficha.recuperacao = document.getElementById('char-recuperacao').dataset.manual ? document.getElementById('char-recuperacao').value : '';
            ficha.sentidos = document.getElementById('char-sentidos').dataset.manual ? document.getElementById('char-sentidos').value : '';
            ficha.conexoesDeriv = document.getElementById('char-conexoes-deriv').dataset.manual ? document.getElementById('char-conexoes-deriv').value : '';

            // Dados do Topo da Aba de Status
            const inputsStatus = document.querySelectorAll('#tab-stats .char-card input');
            if (inputsStatus.length >= 6) {
                ficha.ancestralidade = inputsStatus[0].value;
                ficha.trilha = inputsStatus[1].value;
                ficha.nivel = inputsStatus[2].value;
                ficha.defFisico = inputsStatus[3].value;
                ficha.defCognitivo = inputsStatus[4].value;
                ficha.defEspiritual = inputsStatus[5].value;
            }

            // Atributos e Perícias (Extrai corretamente as 9 bolinhas e as novas)
            ficha.atributos = [];
            document.querySelectorAll('.attr-block').forEach(block => {
                const attrName = block.getAttribute('data-attr-name') || block.querySelector('.attr-header span').innerText.trim();
                const attrVal = block.querySelector('.attr-header input').value;
                const skills = [];
                block.querySelectorAll('.skill-row').forEach(row => {
                    const sText = row.querySelector('.s-text');
                    const skillName = sText ? sText.innerText.trim() : row.querySelector('.skill-name').innerText.trim();
                    const rank = row.querySelectorAll('.skill-dot.filled').length;
                    skills.push({ name: skillName, rank: rank });
                });
                ficha.atributos.push({ nome: attrName, valor: attrVal, pericias: skills });
            });

            // 2. Equipamentos
            ficha.equipamentos = [];
            document.querySelectorAll('#equipment-container .char-card').forEach(card => {
                ficha.equipamentos.push({
                    label: card.querySelector('label').innerText,
                    nome: card.querySelector('.item-name').value,
                    desc: card.querySelector('.slot-desc input').value
                });
            });

            // 3. Talentos
            ficha.talentos = [];
            document.querySelectorAll('#talents-container .talent-card').forEach(card => {
                ficha.talentos.push({
                    nome: card.querySelector('.talent-name').value,
                    descricao: card.querySelector('textarea').value
                });
            });

            // 4. Conexões
            ficha.conexoes = [];
            document.querySelectorAll('#connections-container .connection-medal').forEach(card => {
                ficha.conexoes.push({
                    nome: card.querySelector('.conn-name').value,
                    desc: card.querySelector('.conn-desc').value
                });
            });

            // 5. Narrativa
            ficha.ideal = document.querySelector('.ideal-banner input').value;
            ficha.falha = document.querySelector('.flaw-banner input').value;
            ficha.diario = document.querySelector('.journal-wrapper textarea').value;

            // 6. Anotações do GM
            const gmNotes = document.getElementById('char-gm-notes');
            if(gmNotes) ficha.anotacoesGM = gmNotes.value;

            // 7. Magia / Surgebinding
            ficha.oaths = [];
            for (let i = 1; i <= 5; i++) {
                const oathEl = document.getElementById(`magic-oath${i}`);
                if (oathEl) ficha.oaths.push(oathEl.value);
            }
            ficha.spheres = parseInt(document.getElementById('magic-spheres')?.value) || 0;
            ficha.sphereCharge = parseInt(document.getElementById('magic-sphere-charge')?.value) || 100;
            ficha.sphereType = document.getElementById('magic-sphere-type')?.value || '';

           // Persistência Real via API do Electron
            if (window.api) {
                window.api.saveCharacter(fichaAtualId, JSON.stringify(ficha));
                
                // ATUALIZA A LISTA DA BARRA LATERAL IMEDIATAMENTE (Magia acontece aqui!)
                if (typeof renderizarListaTokens === 'function') {
                    renderizarListaTokens();
                }

                if (mostrarAviso) mostrarAvisoSalvo(); // Feedback visual APENAS se clicar no botão
            }
        }

        function atualizarHPSalvo() {
            if (!fichaAtualId) return;
            fichasSalvas[fichaAtualId].nome = document.getElementById('char-name').value;
            fichasSalvas[fichaAtualId].hpMax = parseInt(document.getElementById('hp-max-input').value) || 10;
            fichasSalvas[fichaAtualId].hpAtual = parseInt(document.getElementById('hp-atual-input').value) || 10;
            
            if (window.api) window.api.saveCharacter(fichaAtualId, JSON.stringify(fichasSalvas[fichaAtualId]));
            if (window.phaserScene) window.phaserScene.updateTokenHP(fichaAtualId, fichasSalvas[fichaAtualId].hpAtual, fichasSalvas[fichaAtualId].hpMax);
            
            const charId = fichaAtualId;
            const hpAtual = fichasSalvas[charId].hpAtual;
            const hpMax = fichasSalvas[charId].hpMax;
            const pctHp = hpMax > 0 ? (hpAtual / hpMax) * 100 : 0;
            const corHp = pctHp > 50 ? '#22c55e' : (pctHp > 20 ? '#eab308' : '#ef4444');
            const hpFill = document.getElementById('sheet-hp-fill');
            if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, pctHp))}%`;
            const hpPill = document.getElementById('sheet-hp-pill');
            if (hpPill) {
                hpPill.innerHTML = `<i class="fas fa-heart"></i> Vida ${hpAtual}/${hpMax}`;
                hpPill.style.borderColor = corHp;
                hpPill.style.color = corHp;
            }
            
            // Aplica a cor diretamente no input principal da Ficha
            const hpAtualInput = document.getElementById('hp-atual-input');
            if (hpAtualInput) {
                hpAtualInput.style.color = corHp;
                hpAtualInput.style.textShadow = `0 0 10px ${corHp}`;
            }
            
            document.querySelectorAll('.token-item').forEach(item => {
                const nameEl = item.querySelector('[style*="font-size: 12px"]');
                if (nameEl && nameEl.textContent.trim() === fichasSalvas[charId].nome) {
                    const hpFill = item.querySelector('[style*="background:"]');
                    if (hpFill && hpFill.style.width) {
                        hpFill.style.width = pctHp + '%';
                        hpFill.style.background = corHp;
                    }
                    const hpText = item.querySelector('[style*="font-family: monospace"]');
                    if (hpText) hpText.textContent = `${hpAtual}/${hpMax}`;
                    const heartIcon = item.querySelector('.fa-heart');
                    if (heartIcon) heartIcon.style.color = corHp;
                }
            });

            // ATUALIZA OS TOKENS BONITINHOS (ROSTER CARDS) DA LISTA
            document.querySelectorAll('.roster-card').forEach(card => {
                const nameEl = card.querySelector('.roster-name');
                if (nameEl && nameEl.textContent.trim() === fichasSalvas[charId].nome) {
                    const hpFill = card.querySelector('.roster-hp-fill');
                    if (hpFill) {
                        hpFill.style.width = pctHp + '%';
                        hpFill.style.background = corHp;
                    }
                    // Se você tiver adicionado o texto de vida nesse card, atualizamos a cor dele também
                    const hpTextEl = card.querySelector('.roster-hp-text');
                    if (hpTextEl) {
                        hpTextEl.textContent = `${hpAtual}/${hpMax}`;
                        hpTextEl.style.color = corHp;
                    }
                }
            });
        }

        function exportarFichaJSON() {
            if (!fichaAtualId || !fichasSalvas[fichaAtualId]) return;
            salvarFichaCompleta();
            const ficha = fichasSalvas[fichaAtualId];
            const jsonStr = JSON.stringify(ficha, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ficha_${(ficha.nome || 'personagem').replace(/\s+/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            addChatMessage('Sistema', `Ficha de <strong>${ficha.nome}</strong> exportada como JSON.`, '#22c55e');
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                fecharFicha();
                document.getElementById('context-menu').classList.add('hidden');
            }
        });

// --- Extracted block: init ---
renderizarAtributosEPericias();
        document.querySelectorAll('.attr-header input').forEach(inp => atualizarModAtributo(inp));

       function atualizarModAtributo(input) {
            // No sistema, o valor que o jogador digita JÁ É o nível/modificador
            const val = parseInt(input.value) || 0; 
            const modSpan = input.parentElement.querySelector('.attr-mod') || (() => {
                const s = document.createElement('span');
                s.className = 'attr-mod';
                s.style.cssText = 'font-size:12px; color:var(--accent); font-weight:bold; margin-left:4px;';
                input.parentElement.appendChild(s);
                return s;
            })();
            
            // Mostra o próprio valor como bônus (ex: +2) e para de fazer (x-10)/2
            modSpan.textContent = val >= 0 ? `+${val}` : `${val}`;
            
            // Recalcula derivados na hora que o número muda
            calcularAtributosDerivados(); 
        }

// --- Extracted block: portrait-link ---
function vincularRetrato(path) {
            if (tipoSeletorRetrato === 'portrait') {
                document.getElementById('char-portrait').src = `file://${path}`;
            } else if (tipoSeletorRetrato === 'token') {
                document.getElementById('char-token-img').src = `file://${path}`;
            }
            document.getElementById('portrait-selector-modal').classList.add('hidden');
            salvarFichaCompleta();
            renderizarListaTokens();
        }

        function addNovaPericiaInput(attrNome) {
            // Apenas redireciona para abrir o modal bonitinho nativo sem usar o prompt do navegador
            abrirModalNovaPericia(attrNome);
        }

function getCurrentCharacterPortraitPayload() {
    const portraitImg = document.getElementById('char-portrait');
    const ficha = fichaAtualId ? fichasSalvas[fichaAtualId] : null;
    const pathFromSheet = ficha?.portraitPath || '';
    const src = portraitImg?.src || '';
    const path = pathFromSheet || src.replace(/^file:\/\//, '');
    const title = ficha?.nome || document.getElementById('char-name')?.value || 'Retrato do personagem';

    if (!path) return null;

    return {
        type: 'image',
        path,
        src: path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')
            ? path
            : (path.startsWith('file://') ? path : `file://${path}`),
        title
    };
}

function getCharacterPortraitPreviewModal() {
    let modal = document.getElementById('character-portrait-preview-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'character-portrait-preview-modal';
    modal.className = 'hidden';
    modal.innerHTML = `
        <div class="character-portrait-preview" onclick="event.stopPropagation()">
            <header class="character-portrait-preview__header">
                <div>
                    <span>Retrato</span>
                    <h2 id="character-portrait-preview-title">Personagem</h2>
                </div>
                <button class="ui-icon-btn" type="button" onclick="closeCharacterPortraitPreview()" title="Fechar"><i class="fas fa-times"></i></button>
            </header>
            <div class="character-portrait-preview__stage">
                <img id="character-portrait-preview-img" src="" alt="">
            </div>
            <footer class="character-portrait-preview__actions">
                <button class="glass-btn primary" type="button" onclick="sendCharacterPortraitToPlayers()">
                    <i class="fas fa-users"></i> Enviar para os players
                </button>
            </footer>
        </div>
    `;
    modal.addEventListener('click', closeCharacterPortraitPreview);
    document.body.appendChild(modal);
    return modal;
}

function openCharacterPortraitPreview() {
    const payload = getCurrentCharacterPortraitPayload();
    if (!payload) {
        if (typeof mostrarToast === 'function') mostrarToast('Nenhum retrato encontrado para ampliar.', 'warning');
        return;
    }

    const modal = getCharacterPortraitPreviewModal();
    const img = modal.querySelector('#character-portrait-preview-img');
    const title = modal.querySelector('#character-portrait-preview-title');

    img.src = payload.src;
    img.alt = payload.title;
    title.textContent = payload.title;
    modal.classList.remove('hidden');
}

function closeCharacterPortraitPreview() {
    const modal = document.getElementById('character-portrait-preview-modal');
    if (modal) modal.classList.add('hidden');
}

function sendCharacterPortraitToPlayers() {
    const payload = getCurrentCharacterPortraitPayload();
    if (!payload) {
        if (typeof mostrarToast === 'function') mostrarToast('Nenhum retrato encontrado para enviar.', 'warning');
        return;
    }

    if (typeof showHandoutPathToPlayers === 'function') {
        showHandoutPathToPlayers(payload.path, 'image', payload.title);
        return;
    }

    if (window.api?.showHandoutToPlayers) {
        window.api.showHandoutToPlayers({ type: 'image', path: payload.path, title: payload.title });
        if (typeof addChatMessage === 'function') addChatMessage('Sistema', 'Retrato enviado para os players.', '#38bdf8');
    }
}

// --- Extracted block: rolls ---
function rollFromSheet(notacao, mod, label, tipo) {
    const partes = notacao.toLowerCase().split('d');
    const qtd    = parseInt(partes[0]) || 1;
    const lados  = parseInt(partes[1]) || 20;
    mod = parseInt(mod) || 0;

    let rolls = [];
    let total = mod;
    for (let i = 0; i < qtd; i++) {
        const r = Math.floor(Math.random() * lados) + 1;
        rolls.push(r);
        total += r;
    }

    const isCrit    = lados === 20 && rolls[0] === 20;
    const isFumble  = lados === 20 && rolls[0] === 1;
    const modStr    = mod !== 0 ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : '';
    const rollsStr  = rolls.length > 1 ? `[${rolls.join('+')}]` : rolls[0];

    let corMensagem = '#e2e8f0';
    let sufixo = '';
    if (isCrit)   { corMensagem = '#fbbf24'; sufixo = ' ✦ CRÍTICO!'; }
    if (isFumble) { corMensagem = '#ef4444'; sufixo = ' ✖ FALHA CRÍTICA!'; }

    const icone = tipo === 'arma' ? '⚔️' : tipo === 'atributo' ? '🧠' : '🎯';
    const msg = `${icone} <b>${label}</b>: ${notacao}${modStr} → <b style="font-size:15px;">${total}</b> <span style="opacity:0.6; font-size:11px;">(${rollsStr}${modStr})</span>${sufixo}`;

    addChatMessage(fichaAtualId ? (fichasSalvas[fichaAtualId]?.nome || 'Jogador') : 'Jogador', msg, corMensagem);

    if (isCrit && window.triggerInvestidura) window.triggerInvestidura('critico');
    
    const overlay = document.querySelector('.crit-overlay');
    if (overlay) {
        if (isCrit)   overlay.classList.add('crit-success-flash');
        if (isFumble) overlay.classList.add('crit-fail-flash');
        setTimeout(() => overlay.className = 'crit-overlay', 1600);
    }

    switchTab('chat');
    setTimeout(() => switchTab('chat'), 50);
}

/**
 * Lê o modificador de um atributo pelo nome.
 * Usa os dots preenchidos para calcular o bônus da perícia.
 */
function getModAtributo(nomeAttr) {
    const blocks = document.querySelectorAll('.attr-block');
    for (const block of blocks) {
        if (block.dataset.attrName === nomeAttr) {
            const val = parseInt(block.querySelector('.attr-header input')?.value) || 10;
            return Math.floor((val - 10) / 2); // Modificador estilo d20
        }
    }
    return 0;
}

function getModPericia(skillRowEl) {
    const dots = skillRowEl.querySelectorAll('.skill-dot.filled').length;
    return dots; // 1 dot preenchido = +1 de bônus
}

// --- Extracted block: portrait-pan ---
// ==========================================
        let isPanningPortrait = false;
        let startPanY = 0;
        let currentPanY = 50;
        let currentScale = 1;

        document.addEventListener('DOMContentLoaded', () => {
            const imgRetrato = document.getElementById('char-portrait');
            if(imgRetrato) {
                imgRetrato.style.cursor = 'ns-resize'; 
                imgRetrato.addEventListener('mousedown', function(e) {
                    isPanningPortrait = true;
                    startPanY = e.clientY;
                    const currentPos = this.style.objectPosition || '50% 50%';
                    currentPanY = parseFloat(currentPos.split(' ')[1]) || 50;
                    e.preventDefault();
                });

                imgRetrato.addEventListener('wheel', function(e) {
                    e.preventDefault();
                    if (e.deltaY < 0) currentScale = Math.min(currentScale + 0.1, 3); // Zoom In
                    else currentScale = Math.max(currentScale - 0.1, 0.5); // Zoom Out
                    
                    this.style.transform = `scale(${currentScale})`;
                });
            }
        });

        document.addEventListener('mousemove', function(e) {
            if (isPanningPortrait) {
                const deltaY = e.clientY - startPanY;
                let newY = currentPanY - (deltaY * 0.3); // Velocidade do arrasto
                newY = Math.max(0, Math.min(100, newY)); // Limita entre 0% e 100%
                document.getElementById('char-portrait').style.objectPosition = `50% ${newY}%`;
            }
        });

        document.addEventListener('mouseup', function(e) {
            if (isPanningPortrait) {
                isPanningPortrait = false;
                if (fichaAtualId && fichasSalvas[fichaAtualId]) {
                    fichasSalvas[fichaAtualId].portraitPos = document.getElementById('char-portrait').style.objectPosition;
                    salvarFichaCompleta(); // Salva a posição no banco
                }
            }
        });

if (typeof window !== 'undefined') {
  window.fichasSalvas = fichasSalvas;
  window.pastasAtores = pastasAtores;
}
