(function initCombatSystem() {
    const CONDITION_DEFINITIONS = [
        { id: 'abalado', name: 'Abalado', emoji: '⚠️', color: '#eab308' },
        { id: 'atordoado', name: 'Atordoado', emoji: '💫', color: '#a78bfa' },
        { id: 'caido', name: 'Caido', emoji: '↩️', color: '#94a3b8' },
        { id: 'concentrando', name: 'Concentrando', emoji: '🎯', color: '#38bdf8' },
        { id: 'envenenado', name: 'Envenenado', emoji: '☠️', color: '#22c55e', startTurnDamage: '1d4', effectMessage: 'sofre dano de veneno' },
        { id: 'ferido', name: 'Ferido', emoji: '🩸', color: '#ef4444' },
        { id: 'invisivel', name: 'Invisivel', emoji: '👁️', color: '#94a3b8' },
        { id: 'investido', name: 'Investido', emoji: '⚡', color: '#3b82f6' },
        { id: 'marcado', name: 'Marcado', emoji: '🎯', color: '#f97316' },
        { id: 'morrendo', name: 'Morrendo', emoji: '💀', color: '#ef4444' },
        { id: 'queimando', name: 'Queimando', emoji: '🔥', color: '#f59e0b', startTurnDamage: '1d6', effectMessage: 'sofre dano de fogo' },
        { id: 'sangrando', name: 'Sangrando', emoji: '🩸', color: '#ef4444', startTurnDamage: '1d4', effectMessage: 'sofre dano de sangramento' }
    ];

    function normalizeLookup(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-');
    }

    function getConditionDefinition(value) {
        const lookup = normalizeLookup(value?.id || value?.name || value?.nome || value);
        return CONDITION_DEFINITIONS.find(condition => condition.id === lookup || normalizeLookup(condition.name) === lookup) || null;
    }

    function normalizeCombatCondition(condition) {
        const source = condition && typeof condition === 'object' ? condition : { name: condition };
        const definition = getConditionDefinition(source);
        const name = source.name || source.nome || definition?.name || String(condition || 'Condicao');
        const durationValue = source.duration ?? source.duracao ?? source.remaining ?? null;
        const duration = durationValue === null || durationValue === '' ? null : Math.max(0, Number(durationValue) || 0);

        return {
            id: source.id || definition?.id || normalizeLookup(name) || `condition-${Date.now()}`,
            name,
            emoji: source.emoji || source.icon || definition?.emoji || '',
            color: source.color || source.cor || definition?.color || '#fbbf24',
            duration,
            startTurnDamage: source.startTurnDamage || source.dano || definition?.startTurnDamage || null,
            effectMessage: source.effectMessage || source.msg || definition?.effectMessage || ''
        };
    }

    function normalizeCombatParticipant(participant, index = 0) {
        const source = participant && typeof participant === 'object' ? participant : {};
        const id = String(source.id || source.tokenId || source.characterId || `participant-${index}`);
        const hpAtual = source.hpAtual ?? source.hp ?? null;
        const hpMax = source.hpMax ?? null;

        return {
            id,
            name: source.name || source.nome || 'Participante',
            initiative: Number(source.initiative ?? source.val) || 0,
            hpAtual: hpAtual === null ? null : Number(hpAtual),
            hpMax: hpMax === null ? null : Number(hpMax),
            conditions: Array.isArray(source.conditions) ? source.conditions.map(normalizeCombatCondition) : [],
            tokenId: source.tokenId || source.link?.tokenId || null,
            characterId: source.characterId || source.link?.characterId || null,
            updatedAt: source.updatedAt || null,
            tokenRef: source.tokenRef || null
        };
    }

    function getEmptyCombatState() {
        return { active: false, round: 1, currentTurnIndex: 0, participants: [] };
    }

    function normalizeCombatState(state) {
        const source = state && typeof state === 'object' ? state : {};
        const participants = Array.isArray(source.participants)
            ? source.participants.map(normalizeCombatParticipant)
            : [];
        const maxIndex = Math.max(0, participants.length - 1);

        return {
            active: Boolean(source.active) && participants.length > 0,
            round: Math.max(1, Number(source.round) || 1),
            currentTurnIndex: Math.min(maxIndex, Math.max(0, Number(source.currentTurnIndex) || 0)),
            participants
        };
    }

    window.COMBAT_CONDITIONS = CONDITION_DEFINITIONS;
    window.normalizeCombatCondition = normalizeCombatCondition;
    window.normalizeCombatState = normalizeCombatState;
    window.combatState = normalizeCombatState(window.combatState || getEmptyCombatState());
    window.selectedToken = window.selectedToken || null;

    function getTokenId(token) {
        return token?.tokenId || token?.characterId || token?.texture?.key || '';
    }

    function getTokenName(token) {
        return token?.charName || token?.texture?.key?.replace('tk_', '').split('_')[0] || 'Token';
    }

    function findTokenById(id) {
        if (!id) return null;
        return window.phaserScene?.camadaTokens?.list?.find(token => getTokenId(token) === id) || null;
    }

    function getCharacterByToken(characterId) {
        if (!characterId) return null;
        return window.fichasSalvas?.[characterId] || null;
    }

    function findParticipantByEntityId(id) {
        if (!id) return null;
        return window.combatState.participants.find(participant => (
            participant.id === id || participant.tokenId === id || participant.characterId === id
        )) || null;
    }

    function getParticipantToken(participant) {
        return participant?.tokenRef || findTokenById(participant?.tokenId || participant?.id);
    }

    function getParticipantCharacter(participant) {
        return getCharacterByToken(participant?.characterId || participant?.id);
    }

    function conditionNames(conditions) {
        return (conditions || []).map(condition => normalizeCombatCondition(condition).name).filter(Boolean);
    }

    function characterConditionsFromCombat(participant, character) {
        const existing = Array.isArray(character?.conditions) ? character.conditions : [];
        return participant.conditions.map(condition => {
            const current = existing.find(item => normalizeLookup(item?.id || item?.name || item) === normalizeLookup(condition.id || condition.name));
            return {
                ...(current && typeof current === 'object' ? current : {}),
                id: current?.id || condition.id,
                name: condition.name,
                icon: condition.emoji || current?.icon || '',
                color: condition.color || current?.color || '#fbbf24',
                durationType: condition.duration === null ? (current?.durationType || 'custom') : 'turns',
                remaining: condition.duration,
                description: current?.description || ''
            };
        });
    }

    function persistParticipantCharacter(participant) {
        const characterId = participant.characterId || participant.id;
        const character = getCharacterByToken(characterId);
        if (!character) return;
        if (Number.isFinite(participant.hpAtual)) character.hpAtual = participant.hpAtual;
        if (Number.isFinite(participant.hpMax)) character.hpMax = participant.hpMax;
        character.conditions = characterConditionsFromCombat(participant, character);
        window.api?.saveCharacter?.(characterId, JSON.stringify(character));
    }

    function syncParticipantMirrors(participant, options = {}) {
        if (!participant) return;
        participant.updatedAt = new Date().toISOString();
        const token = getParticipantToken(participant);
        if (token) {
            participant.tokenId = getTokenId(token);
            participant.tokenRef = token;
            token.hpAtual = participant.hpAtual;
            token.hpMax = participant.hpMax;
            token.conditions = conditionNames(participant.conditions);
            if (Number.isFinite(participant.hpAtual) && Number.isFinite(participant.hpMax)) {
                window.phaserScene?.updateTokenHP?.(getTokenId(token), participant.hpAtual, participant.hpMax);
            }
            window.phaserScene?.renderTokenConditions?.(token);
        }
        if (options.persistCharacter !== false) persistParticipantCharacter(participant);
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
        renderCombatTracker();
    }

    function hydrateParticipantFromLinkedEntity(participant, { fillConditions = true } = {}) {
        const token = getParticipantToken(participant);
        const character = getParticipantCharacter(participant);
        const characterConditions = Array.isArray(character?.conditions) ? character.conditions : [];
        const tokenConditions = Array.isArray(token?.conditions) ? token.conditions : [];
        participant.tokenId = token ? getTokenId(token) : participant.tokenId;
        participant.characterId = character ? (participant.characterId || participant.id) : participant.characterId;
        participant.tokenRef = token || null;
        participant.name = character?.nome || (token ? getTokenName(token) : participant.name);
        if (!Number.isFinite(participant.hpAtual)) participant.hpAtual = Number(character?.hpAtual ?? token?.hpAtual ?? 10);
        if (!Number.isFinite(participant.hpMax)) participant.hpMax = Number(character?.hpMax ?? token?.hpMax ?? 10);
        if (fillConditions && !participant.conditions.length) {
            participant.conditions = (characterConditions.length ? characterConditions : tokenConditions).map(normalizeCombatCondition);
        }
        return participant;
    }

    function makeParticipantFromToken(token) {
        const tokenId = getTokenId(token);
        const character = getCharacterByToken(tokenId);
        return hydrateParticipantFromLinkedEntity(normalizeCombatParticipant({
            id: tokenId,
            name: character?.nome || getTokenName(token),
            initiative: 0,
            hpAtual: token.hpAtual ?? character?.hpAtual ?? character?.hp ?? 10,
            hpMax: token.hpMax ?? character?.hpMax ?? 10,
            conditions: Array.isArray(token.conditions) && token.conditions.length ? token.conditions : character?.conditions,
            tokenId,
            characterId: character ? tokenId : null,
            tokenRef: token
        }));
    }

    function updateEntityVitals(entityId, hpAtual, hpMax) {
        const nextHp = Number(hpAtual);
        const nextMax = Number(hpMax);
        const participant = findParticipantByEntityId(entityId);
        if (participant) {
            if (Number.isFinite(nextHp)) participant.hpAtual = nextHp;
            if (Number.isFinite(nextMax)) participant.hpMax = nextMax;
            syncParticipantMirrors(participant);
            window.markSceneDirty?.('combat-vitals');
            return participant;
        }
        const token = findTokenById(entityId);
        const character = getCharacterByToken(entityId);
        if (token) {
            if (Number.isFinite(nextHp)) token.hpAtual = nextHp;
            if (Number.isFinite(nextMax)) token.hpMax = nextMax;
            window.phaserScene?.updateTokenHP?.(entityId, token.hpAtual, token.hpMax);
        }
        if (character) {
            if (Number.isFinite(nextHp)) character.hpAtual = nextHp;
            if (Number.isFinite(nextMax)) character.hpMax = nextMax;
            window.api?.saveCharacter?.(entityId, JSON.stringify(character));
        }
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
        window.markSceneDirty?.('entity-vitals');
        return null;
    }

    function updateEntityConditions(entityId, conditions) {
        const normalized = (conditions || []).map(normalizeCombatCondition);
        const participant = findParticipantByEntityId(entityId);
        if (participant) {
            participant.conditions = normalized;
            syncParticipantMirrors(participant);
            window.markSceneDirty?.('combat-conditions');
            return participant;
        }
        const token = findTokenById(entityId);
        const character = getCharacterByToken(entityId);
        if (token) {
            token.conditions = conditionNames(normalized);
            window.phaserScene?.renderTokenConditions?.(token);
        }
        if (character) {
            character.conditions = characterConditionsFromCombat({ conditions: normalized }, character);
            window.api?.saveCharacter?.(entityId, JSON.stringify(character));
        }
        if (typeof window.renderizarListaTokens === 'function') window.renderizarListaTokens();
        window.markSceneDirty?.('entity-conditions');
        return null;
    }

    function startCombat() {
        const state = window.combatState;
        if (!state.participants.length) {
            window.addChatMessage?.('Sistema', 'Adicione ao menos um participante antes de iniciar o encontro.', '#ef4444');
            return;
        }
        state.active = true;
        state.round = Math.max(1, state.round || 1);
        state.currentTurnIndex = Math.min(state.currentTurnIndex || 0, state.participants.length - 1);
        renderCombatTracker();
        highlightCurrentTurnToken();
        window.addSessionEvent?.('combat_started', 'Encontro iniciado', `${state.participants.length} participante(s)`);
        window.addChatMessage?.('Sistema', 'Encontro iniciado.', '#fbbf24');
        window.markSceneDirty?.('combat-start');
    }

    function addSelectedTokenToCombat() {
        const token = window.selectedToken;
        if (!token) {
            window.addChatMessage?.('Sistema', 'Selecione um token no mapa primeiro.', '#ef4444');
            return;
        }
        const participant = makeParticipantFromToken(token);
        const existing = findParticipantByEntityId(participant.id);
        if (existing) Object.assign(existing, participant);
        else window.combatState.participants.push(participant);
        renderCombatTracker();
        highlightCurrentTurnToken();
        window.markSceneDirty?.('combat-participants');
    }

    function addManualCombatParticipant() {
        const nameInput = document.getElementById('combat-participant-name');
        const initiativeInput = document.getElementById('combat-participant-initiative');
        const hpInput = document.getElementById('combat-participant-hp');
        const name = nameInput?.value.trim();
        if (!name) return;
        window.combatState.participants.push(normalizeCombatParticipant({
            id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name,
            initiative: Number(initiativeInput?.value) || 0,
            hpAtual: Number(hpInput?.value) || 10,
            hpMax: Number(hpInput?.value) || 10,
            conditions: []
        }, window.combatState.participants.length));
        if (nameInput) nameInput.value = '';
        if (initiativeInput) initiativeInput.value = '';
        if (hpInput) hpInput.value = '';
        sortCombatParticipants();
    }

    function sortCombatParticipants({ preserveCurrent = true } = {}) {
        const currentId = window.combatState.participants[window.combatState.currentTurnIndex]?.id;
        window.combatState.participants.sort((a, b) => b.initiative - a.initiative);
        const nextIndex = preserveCurrent
            ? window.combatState.participants.findIndex(participant => participant.id === currentId)
            : 0;
        window.combatState.currentTurnIndex = nextIndex < 0 ? 0 : nextIndex;
        renderCombatTracker();
        highlightCurrentTurnToken();
        window.markSceneDirty?.('combat-order');
    }

    function rollInitiativeForCombat() {
        window.combatState.participants.forEach(participant => {
            participant.initiative = Math.floor(Math.random() * 20) + 1;
        });
        window.combatState.currentTurnIndex = 0;
        window.combatState.round = Math.max(1, window.combatState.round || 1);
        sortCombatParticipants({ preserveCurrent: false });
    }

    function rollNotation(notation) {
        const match = String(notation || '').match(/^(\d+)d(\d+)$/i);
        if (!match) return 0;
        let total = 0;
        for (let index = 0; index < Number(match[1]); index++) total += Math.floor(Math.random() * Number(match[2])) + 1;
        return total;
    }

    function processStartTurn(participant) {
        if (!participant) return;
        let changed = false;
        const remainingConditions = [];
        participant.conditions.forEach(rawCondition => {
            const condition = normalizeCombatCondition(rawCondition);
            if (condition.startTurnDamage) {
                const damage = rollNotation(condition.startTurnDamage);
                if (damage > 0 && Number.isFinite(participant.hpAtual)) {
                    participant.hpAtual = Math.max(0, participant.hpAtual - damage);
                    changed = true;
                }
                window.addChatMessage?.('Sistema', `${condition.emoji} <strong>${escapeCombatHtml(participant.name)}</strong> ${condition.effectMessage || 'sofre um efeito'}: <strong style="color:${condition.color}">-${damage} HP</strong>`, condition.color);
            }
            if (condition.duration !== null) {
                condition.duration = Math.max(0, condition.duration - 1);
                changed = true;
                if (condition.duration === 0) {
                    window.addChatMessage?.('Sistema', `${condition.emoji} A condicao <strong>${escapeCombatHtml(condition.name)}</strong> de ${escapeCombatHtml(participant.name)} expirou.`, '#94a3b8');
                    return;
                }
            }
            remainingConditions.push(condition);
        });
        participant.conditions = remainingConditions;
        if (changed) syncParticipantMirrors(participant);
    }

    function nextTurn() {
        const state = window.combatState;
        if (!state.active || state.participants.length === 0) return;
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.participants.length;
        if (state.currentTurnIndex === 0) state.round++;
        const participant = state.participants[state.currentTurnIndex];
        processStartTurn(participant);
        renderCombatTracker();
        highlightCurrentTurnToken();
        window.addSessionEvent?.('turn_changed', 'Turno avancado', participant?.name || 'Participante');
        if (participant) window.addChatMessage?.('Sistema', `Turno de <strong>${escapeCombatHtml(participant.name)}</strong>.`, '#fbbf24');
        window.markSceneDirty?.('combat-turn');
    }

    function endCombat() {
        const endedRound = window.combatState.round || 1;
        window.combatState = getEmptyCombatState();
        hideTokenQuickBar();
        window.phaserScene?.clearCurrentTurnHighlight?.();
        renderCombatTracker();
        window.addSessionEvent?.('combat_ended', 'Encontro encerrado', `Rodada ${endedRound}`);
        window.markSceneDirty?.('combat-end');
    }

    function getConditionLabel(condition) {
        const normalized = normalizeCombatCondition(condition);
        return `${normalized.emoji ? `${normalized.emoji} ` : ''}${normalized.name}${normalized.duration !== null ? ` (${normalized.duration})` : ''}`;
    }

    function renderCombatTracker() {
        const container = document.getElementById('combat-tracker-list');
        const roundEl = document.getElementById('combat-round-value');
        if (!container) return;
        const state = window.combatState;
        if (roundEl) roundEl.textContent = state.active ? `Rodada ${state.round}` : 'Fora de encontro';
        if (!state.participants.length) {
            container.innerHTML = '<div class="vtt-empty-state vtt-empty-state--library"><i class="fas fa-shield-halved"></i><span>Nenhum participante no encontro.</span></div>';
            return;
        }
        container.innerHTML = state.participants.map((participant, index) => {
            const isCurrent = state.active && index === state.currentTurnIndex;
            const hp = `${participant.hpAtual ?? '-'}/${participant.hpMax ?? '-'}`;
            const conditions = participant.conditions.map(condition => {
                const normalized = normalizeCombatCondition(condition);
                return `<button class="combat-condition-badge" type="button" data-combat-action="remove-condition" data-participant-id="${escapeCombatAttribute(participant.id)}" data-condition-id="${escapeCombatAttribute(normalized.id)}">${escapeCombatHtml(getConditionLabel(normalized))}</button>`;
            }).join('');
            return `
                <article class="combat-row ${isCurrent ? 'is-current' : ''}">
                    <button class="combat-row__turn" type="button" data-combat-action="set-turn" data-combat-index="${index}">${isCurrent ? '<i class="fas fa-play"></i>' : index + 1}</button>
                    <div class="combat-row__main">
                        <strong>${escapeCombatHtml(participant.name)}</strong>
                        <span>Iniciativa ${participant.initiative || 0} | Vitalidade ${hp}</span>
                        <div class="combat-row__conditions">${conditions || '<em>Sem aflicoes</em>'}</div>
                    </div>
                    <div class="combat-row__actions">
                        <button class="ui-icon-btn" type="button" data-combat-action="add-condition" data-participant-id="${escapeCombatAttribute(participant.id)}" title="Adicionar condicao"><i class="fas fa-plus"></i></button>
                        <button class="ui-icon-btn" type="button" data-combat-action="remove-participant" data-participant-id="${escapeCombatAttribute(participant.id)}" title="Retirar do encontro"><i class="fas fa-times"></i></button>
                    </div>
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
        window.markSceneDirty?.('combat-turn');
    }

    function removeParticipantFromCombat(id) {
        const index = window.combatState.participants.findIndex(participant => participant.id === id);
        if (index < 0) return;
        window.combatState.participants.splice(index, 1);
        window.combatState.currentTurnIndex = Math.min(window.combatState.currentTurnIndex, Math.max(0, window.combatState.participants.length - 1));
        if (!window.combatState.participants.length) window.combatState.active = false;
        renderCombatTracker();
        highlightCurrentTurnToken();
        window.markSceneDirty?.('combat-participants');
    }

    function highlightCurrentTurnToken() {
        const state = window.combatState;
        window.phaserScene?.clearCurrentTurnHighlight?.();
        if (!state.active || !state.participants.length) return;
        const token = getParticipantToken(state.participants[state.currentTurnIndex]);
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
        const participant = findParticipantByEntityId(getTokenId(token));
        const max = Number(participant?.hpMax ?? token.hpMax ?? getCharacterByToken(getTokenId(token))?.hpMax ?? 10);
        const current = Number(participant?.hpAtual ?? token.hpAtual ?? max);
        updateEntityVitals(getTokenId(token), Math.max(0, current - damage), max);
        window.addSessionEvent?.('damage_applied', 'Dano aplicado', `${getTokenName(token)} sofreu ${damage} de dano`);
    }

    function applyHealToSelectedToken(amount) {
        const token = window.selectedToken;
        const heal = Math.max(0, parseInt(amount, 10) || 0);
        if (!token || heal <= 0) return;
        const participant = findParticipantByEntityId(getTokenId(token));
        const max = Number(participant?.hpMax ?? token.hpMax ?? getCharacterByToken(getTokenId(token))?.hpMax ?? 10);
        const current = Number(participant?.hpAtual ?? token.hpAtual ?? max);
        updateEntityVitals(getTokenId(token), Math.min(max, current + heal), max);
        window.addSessionEvent?.('heal_applied', 'Cura aplicada', `${getTokenName(token)} recuperou ${heal} de HP`);
    }

    function promptDamageToSelectedToken() { openHpAdjustModal('damage', applyDamageToSelectedToken); }
    function promptHealToSelectedToken() { openHpAdjustModal('healing', applyHealToSelectedToken); }

    function openHpAdjustModal(mode, onApply) {
        document.querySelector('.hp-adjust-modal')?.remove();
        const isHealing = mode === 'healing';
        const modal = document.createElement('div');
        modal.className = 'hp-adjust-modal';
        modal.innerHTML = `
            <div class="hp-adjust-modal__dialog" role="dialog" aria-modal="true" aria-label="${isHealing ? 'Recuperar vitalidade' : 'Marcar ferimento'}">
                <header class="hp-adjust-modal__header"><strong>${isHealing ? 'Recuperar Vitalidade' : 'Marcar Ferimento'}</strong><button class="ui-icon-btn" type="button" data-hp-adjust-action="close" title="Fechar"><i class="fas fa-times"></i></button></header>
                <div class="hp-adjust-modal__quick">${[1, 5, 10].map(value => `<button type="button" data-hp-adjust-value="${value}">${isHealing ? '+' : '-'}${value}</button>`).join('')}</div>
                <label class="hp-adjust-modal__field"><span>Pontos</span><input class="vtt-input" type="number" min="1" value="1" data-hp-adjust-input></label>
                <div class="hp-adjust-modal__actions"><button class="ui-btn" type="button" data-hp-adjust-action="close">Cancelar</button><button class="ui-btn ui-btn--primary" type="button" data-hp-adjust-action="apply">${isHealing ? 'Restaurar' : 'Marcar'}</button></div>
            </div>
        `;
        const close = () => modal.remove();
        const apply = amount => {
            const value = Math.max(0, parseInt(amount, 10) || 0);
            if (value > 0) onApply?.(value);
            close();
        };
        modal.addEventListener('click', event => {
            if (event.target === modal) return close();
            const quick = event.target.closest('[data-hp-adjust-value]');
            if (quick) return apply(quick.dataset.hpAdjustValue);
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

    function buildConditionMenu(onSelect, anchor = document.querySelector('.token-quick-bar')) {
        document.querySelector('.condition-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'condition-menu';
        CONDITION_DEFINITIONS.forEach(condition => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${condition.emoji} ${condition.name}`;
            button.addEventListener('click', () => {
                onSelect(condition);
                menu.remove();
            });
            menu.appendChild(button);
        });
        document.body.appendChild(menu);
        const rect = anchor?.getBoundingClientRect();
        menu.style.left = `${rect ? rect.left : 18}px`;
        menu.style.top = `${rect ? Math.min(window.innerHeight - menu.offsetHeight - 12, rect.bottom + 8) : 80}px`;
    }

    function openConditionMenu(token = window.selectedToken) {
        if (!token) return;
        buildConditionMenu(condition => toggleEntityCondition(getTokenId(token), condition));
    }

    function openParticipantConditionMenu(participantId, anchor) {
        buildConditionMenu(condition => addCondition(participantId, condition), anchor);
    }

    function toggleEntityCondition(entityId, condition) {
        const participant = findParticipantByEntityId(entityId);
        const token = findTokenById(entityId);
        const current = participant?.conditions || (token?.conditions || []).map(normalizeCombatCondition);
        const normalized = normalizeCombatCondition(condition);
        if (current.some(item => normalizeCombatCondition(item).id === normalized.id)) removeCondition(entityId, normalized.id);
        else addCondition(entityId, normalized);
    }

    function addCondition(entityId, condition, duration = null) {
        const normalized = normalizeCombatCondition({ ...(condition && typeof condition === 'object' ? condition : { name: condition }), ...(duration === null ? {} : { duration }) });
        const participant = findParticipantByEntityId(entityId);
        const token = findTokenById(entityId);
        const current = participant?.conditions || (token?.conditions || []).map(normalizeCombatCondition);
        if (!current.some(item => normalizeCombatCondition(item).id === normalized.id)) current.push(normalized);
        updateEntityConditions(entityId, current);
        window.addSessionEvent?.('condition_added', 'Condicao adicionada', `${participant?.name || (token ? getTokenName(token) : entityId)}: ${normalized.name}`);
    }

    function removeCondition(entityId, conditionId) {
        const participant = findParticipantByEntityId(entityId);
        const token = findTokenById(entityId);
        const current = participant?.conditions || (token?.conditions || []).map(normalizeCombatCondition);
        const removed = current.find(item => {
            const condition = normalizeCombatCondition(item);
            return condition.id === conditionId || condition.name === conditionId;
        });
        updateEntityConditions(entityId, current.filter(item => {
            const condition = normalizeCombatCondition(item);
            return condition.id !== conditionId && condition.name !== conditionId;
        }));
        if (removed) window.addSessionEvent?.('condition_removed', 'Condicao removida', `${participant?.name || (token ? getTokenName(token) : entityId)}: ${normalizeCombatCondition(removed).name}`);
    }

    function clearConditionsForEntity(entityId) { updateEntityConditions(entityId, []); }

    function restoreCombatState(state) {
        window.combatState = normalizeCombatState(state);
        window.combatState.participants.forEach(participant => {
            hydrateParticipantFromLinkedEntity(participant, { fillConditions: !window.combatState.active });
        });
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function restoreCombatAfterTokensLoaded(state) {
        restoreCombatState(state);
        window.combatState.participants.forEach(participant => {
            hydrateParticipantFromLinkedEntity(participant, { fillConditions: !window.combatState.active });
            if (window.combatState.active) {
                syncParticipantMirrors(participant);
                return;
            }
            const character = getParticipantCharacter(participant);
            const token = getParticipantToken(participant);
            if (character) {
                participant.hpAtual = Number(character.hpAtual ?? participant.hpAtual ?? 10);
                participant.hpMax = Number(character.hpMax ?? participant.hpMax ?? 10);
                participant.conditions = (character.conditions || []).map(normalizeCombatCondition);
            } else if (token) {
                participant.hpAtual = Number(token.hpAtual ?? participant.hpAtual ?? 10);
                participant.hpMax = Number(token.hpMax ?? participant.hpMax ?? 10);
                participant.conditions = (token.conditions || []).map(normalizeCombatCondition);
            }
            syncParticipantMirrors(participant, { persistCharacter: false });
        });
        renderCombatTracker();
        highlightCurrentTurnToken();
    }

    function escapeCombatHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function escapeCombatAttribute(value) { return escapeCombatHtml(value).replace(/`/g, '&#96;'); }

    Object.assign(window, {
        startCombat, addSelectedTokenToCombat, addManualCombatParticipant, rollInitiativeForCombat,
        sortCombatParticipants, nextTurn, endCombat, renderCombatTracker, highlightCurrentTurnToken,
        showTokenQuickBar, positionTokenQuickBar: positionQuickBar, hideTokenQuickBar,
        applyDamageToSelectedToken, applyHealToSelectedToken, openConditionMenu, addCondition,
        removeCondition, clearConditionsForEntity, restoreCombatState, restoreCombatAfterTokensLoaded,
        getCharacterByToken, updateEntityVitals, updateEntityConditions,
        setCombatTurn, removeParticipantFromCombat,
        promptDamageToSelectedToken, promptHealToSelectedToken, openHpAdjustModal,
        openSelectedTokenSheet, removeSelectedToken
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('combat-tracker-list')?.addEventListener('click', event => {
            const actionButton = event.target.closest('[data-combat-action]');
            if (!actionButton) return;
            const action = actionButton.dataset.combatAction;
            if (action === 'set-turn') setCombatTurn(Number(actionButton.dataset.combatIndex));
            if (action === 'remove-participant') removeParticipantFromCombat(actionButton.dataset.participantId);
            if (action === 'add-condition') openParticipantConditionMenu(actionButton.dataset.participantId, actionButton);
            if (action === 'remove-condition') removeCondition(actionButton.dataset.participantId, actionButton.dataset.conditionId);
        });
        renderCombatTracker();
    });
})();
