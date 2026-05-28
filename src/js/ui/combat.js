(function initCombatSystem() {
    const DEFAULT_CONDITIONS = [
        'Caido',
        'Atordoado',
        'Sangrando',
        'Concentrando',
        'Invisivel',
        'Marcado',
        'Morrendo'
    ];

    window.CONDITIONS = window.CONDITIONS || DEFAULT_CONDITIONS;
    window.combatState = window.combatState || {
        active: false,
        round: 1,
        currentTurnIndex: 0,
        participants: []
    };
    window.sceneSettings = window.sceneSettings || {
        gridEnabled: true,
        gridSize: 70,
        snapToGrid: true,
        distancePerCell: 2,
        distanceUnit: 'm'
    };
    window.selectedToken = window.selectedToken || null;

    const legacyNextTurn = window.nextTurn;

    function getTokenId(token) {
        return token?.tokenId || token?.characterId || token?.texture?.key || '';
    }

    function getTokenName(token) {
        return token?.charName || token?.texture?.key?.replace('tk_', '').split('_')[0] || 'Token';
    }

    function findTokenById(id) {
        return window.phaserScene?.camadaTokens?.list?.find(token => getTokenId(token) === id) || null;
    }

    function getCharacterByToken(tokenId) {
        if (!tokenId) return null;
        return window.fichasSalvas?.[tokenId] || null;
    }

    function syncParticipantFromToken(token) {
        if (!token) return;
        const participant = window.combatState.participants.find(p => p.id === getTokenId(token));
        if (!participant) return;
        participant.name = getTokenName(token);
        participant.hpAtual = Number.isFinite(Number(token.hpAtual)) ? Number(token.hpAtual) : participant.hpAtual;
        participant.hpMax = Number.isFinite(Number(token.hpMax)) ? Number(token.hpMax) : participant.hpMax;
        participant.conditions = Array.isArray(token.conditions) ? [...token.conditions] : participant.conditions || [];
        participant.tokenRef = token;
    }

    function makeParticipantFromToken(token) {
        const tokenId = getTokenId(token);
        const ficha = getCharacterByToken(tokenId);
        const hpAtual = Number.isFinite(Number(token.hpAtual)) ? Number(token.hpAtual) : Number(ficha?.hpAtual ?? ficha?.hp ?? 10);
        const hpMax = Number.isFinite(Number(token.hpMax)) ? Number(token.hpMax) : Number(ficha?.hpMax ?? 10);

        return {
            id: tokenId,
            name: ficha?.nome || getTokenName(token),
            initiative: 0,
            hpAtual,
            hpMax,
            conditions: Array.isArray(token.conditions) ? [...token.conditions] : [],
            tokenRef: token
        };
    }

    function updateCharacterHP(characterId, hpAtual, hpMax) {
        if (!characterId || !window.fichasSalvas?.[characterId]) return;
        window.fichasSalvas[characterId].hpAtual = hpAtual;
        window.fichasSalvas[characterId].hpMax = hpMax;
        if (window.api?.saveCharacter) {
            window.api.saveCharacter(characterId, JSON.stringify(window.fichasSalvas[characterId]));
        }
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
    }

    function updateCharacterConditions(characterId, conditions) {
        if (!characterId || !window.fichasSalvas?.[characterId]) return;
        const names = (conditions || []).map(condition => condition?.name || condition).filter(Boolean);
        const existing = Array.isArray(window.fichasSalvas[characterId].conditions) ? window.fichasSalvas[characterId].conditions : [];
        window.fichasSalvas[characterId].conditions = names.map(name => {
            const current = existing.find(condition => (condition?.name || condition) === name);
            return typeof current === 'object' && current ? current : {
                id: `cond_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                name,
                icon: '',
                color: '#fbbf24',
                durationType: 'custom',
                remaining: null,
                description: ''
            };
        });
        if (window.api?.saveCharacter) {
            window.api.saveCharacter(characterId, JSON.stringify(window.fichasSalvas[characterId]));
        }
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
    }

    function updateTokenHPBar(token, hpAtual, hpMax) {
        if (!token || !window.phaserScene) return;
        window.phaserScene.updateTokenHP(getTokenId(token), hpAtual, hpMax);
    }

    function updateTokenAndCharacterHP(token, hpAtual, hpMax) {
        if (!token) return;
        token.hpAtual = hpAtual;
        token.hpMax = hpMax;
        updateTokenHPBar(token, hpAtual, hpMax);
        updateCharacterHP(getTokenId(token), hpAtual, hpMax);
        syncParticipantFromToken(token);
        renderCombatTracker();
    }

    function startCombat() {
        window.combatState.active = true;
        window.combatState.round = window.combatState.round || 1;
        window.combatState.currentTurnIndex = window.combatState.currentTurnIndex || 0;
        renderCombatTracker();
        highlightCurrentTurnToken();
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent(
                'combat_started',
                'Encontro iniciado',
                `${window.combatState.participants.length} participante(s)`
            );
        }
        if (typeof addChatMessage === 'function') addChatMessage('Sistema', 'Encontro iniciado.', '#fbbf24');
    }

    function addSelectedTokenToCombat() {
        const token = window.selectedToken;
        if (!token) {
            if (typeof addChatMessage === 'function') addChatMessage('Sistema', 'Selecione um token no mapa primeiro.', '#ef4444');
            return;
        }

        const participant = makeParticipantFromToken(token);
        if (!participant.id) return;

        const existing = window.combatState.participants.find(p => p.id === participant.id);
        if (existing) {
            Object.assign(existing, participant);
        } else {
            window.combatState.participants.push(participant);
        }

        window.combatState.active = true;
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function rollInitiativeForCombat() {
        window.combatState.participants.forEach(participant => {
            participant.initiative = Math.floor(Math.random() * 20) + 1;
        });
        window.combatState.participants.sort((a, b) => b.initiative - a.initiative);
        window.combatState.currentTurnIndex = 0;
        window.combatState.round = window.combatState.round || 1;
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function combatNextTurn() {
        const state = window.combatState;
        if (!state.active || state.participants.length === 0) return;
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.participants.length;
        if (state.currentTurnIndex === 0) state.round++;
        renderCombatTracker();
        highlightCurrentTurnToken();
        const participant = state.participants[state.currentTurnIndex];
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('turn_changed', 'Turno avancado', participant?.name || 'Participante');
        }
        if (participant && typeof addChatMessage === 'function') {
            addChatMessage('Sistema', `Turno de <strong>${participant.name}</strong>.`, '#fbbf24');
        }
    }

    function endCombat() {
        const endedRound = window.combatState.round || 1;
        window.combatState.active = false;
        window.combatState.round = 1;
        window.combatState.currentTurnIndex = 0;
        window.combatState.participants = [];
        hideTokenQuickBar();
        window.phaserScene?.clearCurrentTurnHighlight?.();
        renderCombatTracker();
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('combat_ended', 'Encontro encerrado', `Rodada ${endedRound}`);
        }
    }

    function renderCombatTracker() {
        const container = document.getElementById('combat-tracker-list');
        const roundEl = document.getElementById('combat-round-value');
        if (!container) return;

        const state = window.combatState;
        if (roundEl) roundEl.textContent = state.active ? `Rodada ${state.round}` : 'Fora de encontro';

        if (!state.participants.length) {
            container.innerHTML = '<div class="vtt-empty-state vtt-empty-state--library"><i class="fas fa-shield-halved"></i><span>Nenhuma miniatura no encontro.</span></div>';
            return;
        }

        container.innerHTML = state.participants.map((participant, index) => {
            const isCurrent = state.active && index === state.currentTurnIndex;
            const hp = `${participant.hpAtual ?? '-'}/${participant.hpMax ?? '-'}`;
            const conditions = (participant.conditions || []).map(cond => `
                <button class="combat-condition-badge" type="button" onclick="removeCondition('${participant.id}', '${cond}')">${cond}</button>
            `).join('');

            return `
                <article class="combat-row ${isCurrent ? 'is-current' : ''}">
                    <button class="combat-row__turn" type="button" onclick="setCombatTurn(${index})">${isCurrent ? '<i class="fas fa-play"></i>' : index + 1}</button>
                    <div class="combat-row__main">
                        <strong>${escapeCombatHtml(participant.name)}</strong>
                        <span>Iniciativa ${participant.initiative || 0} | Vitalidade ${hp}</span>
                        <div class="combat-row__conditions">${conditions || '<em>Sem aflicoes</em>'}</div>
                    </div>
                    <button class="ui-icon-btn" type="button" onclick="removeParticipantFromCombat('${participant.id}')" title="Retirar do encontro"><i class="fas fa-times"></i></button>
                </article>
            `;
        }).join('');
    }

    function setCombatTurn(index) {
        if (!window.combatState.participants[index]) return;
        window.combatState.currentTurnIndex = index;
        window.combatState.active = true;
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function removeParticipantFromCombat(id) {
        const index = window.combatState.participants.findIndex(p => p.id === id);
        if (index < 0) return;
        window.combatState.participants.splice(index, 1);
        window.combatState.currentTurnIndex = Math.min(window.combatState.currentTurnIndex, Math.max(0, window.combatState.participants.length - 1));
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function highlightCurrentTurnToken() {
        const state = window.combatState;
        window.phaserScene?.clearCurrentTurnHighlight?.();
        if (!state.active || !state.participants.length) return;
        const current = state.participants[state.currentTurnIndex];
        const token = findTokenById(current?.id);
        if (token) window.phaserScene?.highlightCurrentTurnToken?.(token);
    }

    function showTokenQuickBar(token) {
        if (!token) return;
        window.selectedToken = token;
        document.querySelector('.token-quick-bar')?.remove();

        const bar = document.createElement('div');
        bar.className = 'token-quick-bar';
        bar.innerHTML = `
            <button type="button" onclick="openSelectedTokenSheet()" title="Abrir ficha"><i class="fas fa-address-card"></i></button>
            <button type="button" onclick="promptDamageToSelectedToken()" title="Ferimento"><i class="fas fa-heart-crack"></i></button>
            <button type="button" onclick="promptHealToSelectedToken()" title="Recuperacao"><i class="fas fa-hand-holding-medical"></i></button>
            <button type="button" onclick="openConditionMenu()" title="Aflicao"><i class="fas fa-skull-crossbones"></i></button>
            <button type="button" onclick="addSelectedTokenToCombat()" title="Entrar no encontro"><i class="fas fa-shield-halved"></i></button>
            <button type="button" onclick="removeSelectedToken()" title="Retirar miniatura"><i class="fas fa-skull"></i></button>
        `;
        document.body.appendChild(bar);
        positionQuickBar(token, bar);
    }

    function positionQuickBar(token, bar = document.querySelector('.token-quick-bar')) {
        if (!token || !bar || !window.phaserScene) return;
        const camera = window.phaserScene.cameras.main;
        const screenX = (token.x - camera.scrollX) * camera.zoom;
        const screenY = (token.y - camera.scrollY) * camera.zoom;
        bar.style.left = `${Math.min(window.innerWidth - 260, Math.max(12, screenX + 20))}px`;
        bar.style.top = `${Math.min(window.innerHeight - 60, Math.max(12, screenY - 24))}px`;
    }

    function hideTokenQuickBar() {
        document.querySelector('.token-quick-bar')?.remove();
        document.querySelector('.condition-menu')?.remove();
    }

    function applyDamageToSelectedToken(amount) {
        const token = window.selectedToken;
        const damage = Math.max(0, parseInt(amount, 10) || 0);
        if (!token || damage <= 0) return;
        const max = Number(token.hpMax || getCharacterByToken(getTokenId(token))?.hpMax || 10);
        const current = Number(token.hpAtual ?? max);
        updateTokenAndCharacterHP(token, Math.max(0, current - damage), max);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('damage_applied', 'Dano aplicado', `${getTokenName(token)} sofreu ${damage} de dano`);
        }
    }

    function applyHealToSelectedToken(amount) {
        const token = window.selectedToken;
        const heal = Math.max(0, parseInt(amount, 10) || 0);
        if (!token || heal <= 0) return;
        const max = Number(token.hpMax || getCharacterByToken(getTokenId(token))?.hpMax || 10);
        const current = Number(token.hpAtual ?? max);
        updateTokenAndCharacterHP(token, Math.min(max, current + heal), max);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('heal_applied', 'Cura aplicada', `${getTokenName(token)} recuperou ${heal} de HP`);
        }
    }

    function promptDamageToSelectedToken() {
        openHpAdjustModal('damage', applyDamageToSelectedToken);
    }

    function promptHealToSelectedToken() {
        openHpAdjustModal('healing', applyHealToSelectedToken);
    }

    function openHpAdjustModal(mode, onApply) {
        document.querySelector('.hp-adjust-modal')?.remove();
        const isHealing = mode === 'healing';
        const modal = document.createElement('div');
        modal.className = 'hp-adjust-modal';
        modal.innerHTML = `
            <div class="hp-adjust-modal__dialog" role="dialog" aria-modal="true" aria-label="${isHealing ? 'Recuperar vitalidade' : 'Marcar ferimento'}">
                <header class="hp-adjust-modal__header">
                    <strong>${isHealing ? 'Recuperar Vitalidade' : 'Marcar Ferimento'}</strong>
                    <button class="ui-icon-btn" type="button" data-hp-adjust-action="close" title="Fechar"><i class="fas fa-times"></i></button>
                </header>
                <div class="hp-adjust-modal__quick">
                    ${[1, 5, 10].map(value => `<button type="button" data-hp-adjust-value="${value}">${isHealing ? '+' : '-'}${value}</button>`).join('')}
                </div>
                <label class="hp-adjust-modal__field">
                    <span>Pontos</span>
                    <input class="vtt-input" type="number" min="1" value="1" data-hp-adjust-input>
                </label>
                <div class="hp-adjust-modal__actions">
                    <button class="ui-btn" type="button" data-hp-adjust-action="close">Cancelar</button>
                    <button class="ui-btn ui-btn--primary" type="button" data-hp-adjust-action="apply">${isHealing ? 'Restaurar' : 'Marcar'}</button>
                </div>
            </div>
        `;

        const close = () => modal.remove();
        const apply = (amount) => {
            const value = Math.max(0, parseInt(amount, 10) || 0);
            if (value > 0 && typeof onApply === 'function') onApply(value);
            close();
        };

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                close();
                return;
            }

            const quick = event.target.closest('[data-hp-adjust-value]');
            if (quick) {
                apply(quick.dataset.hpAdjustValue);
                return;
            }

            const action = event.target.closest('[data-hp-adjust-action]')?.dataset.hpAdjustAction;
            if (action === 'close') close();
            if (action === 'apply') apply(modal.querySelector('[data-hp-adjust-input]')?.value);
        });

        document.body.appendChild(modal);
        const input = modal.querySelector('[data-hp-adjust-input]');
        input?.focus();
        input?.select();
    }

    function openSelectedTokenSheet() {
        const token = window.selectedToken;
        if (token && typeof window.abrirFicha === 'function') window.abrirFicha(getTokenName(token), getTokenId(token));
    }

    function removeSelectedToken() {
        const token = window.selectedToken;
        if (token && window.phaserScene?.removeToken) {
            window.phaserScene.removeToken(token);
            hideTokenQuickBar();
        }
    }

    function openConditionMenu(token = window.selectedToken) {
        if (!token) return;
        document.querySelector('.condition-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'condition-menu';
        menu.innerHTML = window.CONDITIONS.map(cond => `
            <button type="button" onclick="toggleSelectedTokenCondition('${cond}')">${cond}</button>
        `).join('');
        document.body.appendChild(menu);
        const bar = document.querySelector('.token-quick-bar');
        const rect = bar?.getBoundingClientRect();
        menu.style.left = `${rect ? rect.left : 18}px`;
        menu.style.top = `${rect ? rect.bottom + 8 : 80}px`;
    }

    function toggleSelectedTokenCondition(condition) {
        const token = window.selectedToken;
        if (!token) return;
        const tokenId = getTokenId(token);
        if ((token.conditions || []).includes(condition)) removeCondition(tokenId, condition);
        else addCondition(tokenId, condition);
    }

    function addCondition(tokenId, condition) {
        const token = findTokenById(tokenId) || (getTokenId(window.selectedToken) === tokenId ? window.selectedToken : null);
        if (!token || !condition) return;
        token.conditions = Array.isArray(token.conditions) ? token.conditions : [];
        if (!token.conditions.includes(condition)) token.conditions.push(condition);
        window.phaserScene?.renderTokenConditions?.(token);
        const participant = window.combatState.participants.find(p => p.id === tokenId);
        if (participant) participant.conditions = [...token.conditions];
        updateCharacterConditions(tokenId, token.conditions);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('condition_added', 'Condicao adicionada', `${getTokenName(token)}: ${condition}`);
        }
        renderCombatTracker();
    }

    function removeCondition(tokenId, condition) {
        const token = findTokenById(tokenId) || (getTokenId(window.selectedToken) === tokenId ? window.selectedToken : null);
        if (!token || !condition) return;
        token.conditions = (token.conditions || []).filter(item => item !== condition);
        window.phaserScene?.renderTokenConditions?.(token);
        const participant = window.combatState.participants.find(p => p.id === tokenId);
        if (participant) participant.conditions = [...token.conditions];
        updateCharacterConditions(tokenId, token.conditions);
        if (typeof window.addSessionEvent === 'function') {
            window.addSessionEvent('condition_removed', 'Condicao removida', `${getTokenName(token)}: ${condition}`);
        }
        renderCombatTracker();
    }

    function restoreCombatState(state) {
        window.combatState = {
            active: !!state?.active,
            round: state?.round || 1,
            currentTurnIndex: state?.currentTurnIndex || 0,
            participants: Array.isArray(state?.participants) ? state.participants.map(participant => ({
                ...participant,
                tokenRef: findTokenById(participant.id)
            })) : []
        };
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function restoreCombatAfterTokensLoaded(state) {
        restoreCombatState(state);
        window.combatState.participants.forEach(participant => {
            const token = findTokenById(participant.id);
            if (!token) return;
            const ficha = getCharacterByToken(participant.id);
            if (ficha) {
                token.hpAtual = ficha.hpAtual;
                token.hpMax = ficha.hpMax;
                token.conditions = Array.isArray(ficha.conditions)
                    ? ficha.conditions.map(condition => condition?.name || condition).filter(Boolean)
                    : [];
            } else {
                token.hpAtual = participant.hpAtual;
                token.hpMax = participant.hpMax;
                token.conditions = Array.isArray(participant.conditions) ? [...participant.conditions] : [];
            }
            window.phaserScene?.updateTokenHP?.(participant.id, token.hpAtual, token.hpMax);
            window.phaserScene?.renderTokenConditions?.(token);
            syncParticipantFromToken(token);
        });
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function escapeCombatHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function syncSceneSettingsControls() {
        const settings = window.sceneSettings || {};
        const gridEnabled = document.getElementById('scene-grid-enabled');
        const snap = document.getElementById('scene-grid-snap');
        const gridSize = document.getElementById('scene-grid-size');
        const distance = document.getElementById('scene-distance-cell');
        const unit = document.getElementById('scene-distance-unit');
        if (gridEnabled) gridEnabled.checked = settings.gridEnabled !== false;
        if (snap) snap.checked = settings.snapToGrid !== false;
        if (gridSize) gridSize.value = settings.gridSize || 70;
        if (distance) distance.value = settings.distancePerCell || 2;
        if (unit) unit.value = settings.distanceUnit || 'm';
    }

    function toggleGrid() {
        window.phaserScene?.toggleGrid?.();
        syncSceneSettingsControls();
    }

    function setGridSize(size) {
        window.phaserScene?.setGridSize?.(size);
        syncSceneSettingsControls();
    }

    function toggleSnapToGrid() {
        window.phaserScene?.toggleSnapToGrid?.();
        syncSceneSettingsControls();
    }

    function setSceneDistancePerCell(value) {
        window.sceneSettings = {
            ...(window.sceneSettings || {}),
            distancePerCell: Math.max(0.1, parseFloat(value) || 1)
        };
        if (window.phaserScene) window.phaserScene.sceneSettings = window.sceneSettings;
    }

    function setSceneDistanceUnit(value) {
        window.sceneSettings = {
            ...(window.sceneSettings || {}),
            distanceUnit: value || 'm'
        };
        if (window.phaserScene) window.phaserScene.sceneSettings = window.sceneSettings;
    }

    window.startCombat = startCombat;
    window.addSelectedTokenToCombat = addSelectedTokenToCombat;
    window.rollInitiativeForCombat = rollInitiativeForCombat;
    window.endCombat = endCombat;
    window.renderCombatTracker = renderCombatTracker;
    window.highlightCurrentTurnToken = highlightCurrentTurnToken;
    window.showTokenQuickBar = showTokenQuickBar;
    window.positionTokenQuickBar = positionQuickBar;
    window.hideTokenQuickBar = hideTokenQuickBar;
    window.applyDamageToSelectedToken = applyDamageToSelectedToken;
    window.applyHealToSelectedToken = applyHealToSelectedToken;
    window.openConditionMenu = openConditionMenu;
    window.addCondition = addCondition;
    window.removeCondition = removeCondition;
    window.restoreCombatState = restoreCombatState;
    window.restoreCombatAfterTokensLoaded = restoreCombatAfterTokensLoaded;
    window.getCharacterByToken = getCharacterByToken;
    window.updateCharacterHP = updateCharacterHP;
    window.updateCharacterConditions = updateCharacterConditions;
    window.updateTokenHPBar = updateTokenHPBar;
    window.setCombatTurn = setCombatTurn;
    window.removeParticipantFromCombat = removeParticipantFromCombat;
    window.promptDamageToSelectedToken = promptDamageToSelectedToken;
    window.promptHealToSelectedToken = promptHealToSelectedToken;
    window.openHpAdjustModal = openHpAdjustModal;
    window.openSelectedTokenSheet = openSelectedTokenSheet;
    window.removeSelectedToken = removeSelectedToken;
    window.toggleSelectedTokenCondition = toggleSelectedTokenCondition;
    window.syncSceneSettingsControls = syncSceneSettingsControls;
    window.toggleGrid = toggleGrid;
    window.setGridSize = setGridSize;
    window.toggleSnapToGrid = toggleSnapToGrid;
    window.setSceneDistancePerCell = setSceneDistancePerCell;
    window.setSceneDistanceUnit = setSceneDistanceUnit;
    window.nextTurn = function nextTurnBridge() {
        if (window.combatState?.active) return combatNextTurn();
        if (typeof legacyNextTurn === 'function') return legacyNextTurn();
    };

    document.addEventListener('DOMContentLoaded', () => {
        renderCombatTracker();
        syncSceneSettingsControls();
    });
})();
