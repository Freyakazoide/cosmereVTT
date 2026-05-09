// --- SISTEMA DE INICIATIVA + TRACKER DE CONDIÇÕES ---

// Definição de todas as condições disponíveis
const CONDICOES = [
    { id: 'sangrando',   label: 'Sangrando',   emoji: '🩸', cor: '#ef4444', danoTurno: true,  dano: '1d4', msg: 'sofre dano de sangramento' },
    { id: 'queimando',   label: 'Queimando',   emoji: '🔥', cor: '#f59e0b', danoTurno: true,  dano: '1d6', msg: 'sofre dano de fogo' },
    { id: 'investido',   label: 'Investido',   emoji: '⚡', cor: '#3b82f6', danoTurno: false, dano: '',    msg: 'está com Luz Tempestuosa ativa' },
    { id: 'atordoado',   label: 'Atordoado',   emoji: '💫', cor: '#a78bfa', danoTurno: false, dano: '',    msg: 'está atordoado — não pode agir!' },
    { id: 'envenenado',  label: 'Envenenado',  emoji: '☠️', cor: '#22c55e', danoTurno: true,  dano: '1d4', msg: 'sofre dano de veneno' },
    { id: 'caido',       label: 'Caído',       emoji: '🪃', cor: '#94a3b8', danoTurno: false, dano: '',    msg: 'está prostrado no chão' },
];

let initiativeList  = [];
let currentInitIndex = -1;
let currentRound = 1;
window.initiativeList = initiativeList;
window.currentRound = currentRound;

function makeInitiativeDraggable() {
    const tracker = document.getElementById('init-tracker');
    if (!tracker) return;

    if (tracker.dataset.dragAtivo) return;
    tracker.dataset.dragAtivo = 'true';

    let isDragging = false;
    let offX = 0;
    let offY = 0;

    tracker.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.tagName === 'INPUT' || e.target.closest('.init-list') || e.target.closest('.init-controls')) return;

        isDragging = true;
        const rect = tracker.getBoundingClientRect();
        tracker.style.position = 'fixed';
        tracker.style.left = rect.left + 'px';
        tracker.style.top = rect.top + 'px';
        tracker.style.right = 'auto';
        tracker.style.bottom = 'auto';
        tracker.style.margin = '0';
        tracker.style.transform = 'none';

        offX = e.clientX - rect.left;
        offY = e.clientY - rect.top;
        tracker.classList.add('init-tracker-dragging');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        tracker.style.left = (e.clientX - offX) + 'px';
        tracker.style.top = (e.clientY - offY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        tracker.classList.remove('init-tracker-dragging');
    });
}

function collapseInitiative() {
    const list = document.getElementById('init-list');
    const controls = document.querySelector('.init-controls');
    if (!list || !controls) return;

    if (list.style.display === 'none') {
        list.style.display = 'block';
        controls.style.display = 'flex';
    } else {
        list.style.display = 'none';
        controls.style.display = 'none';
    }
}

function toggleInitiative() {
    document.getElementById('init-tracker').classList.toggle('hidden');
}

        function addInitiative() {
    const name = document.getElementById('init-name').value.trim() || 'Desconhecido';
    const val  = parseInt(document.getElementById('init-val').value) || 0;
    initiativeList.push({ name, val, conditions: [] });
    initiativeList.sort((a, b) => b.val - a.val);
    document.getElementById('init-name').value = '';
    document.getElementById('init-val').value  = '';
    renderInitiative();
    
    // --- SINCRONIZA CONDIÇÕES DO TOKEN ---
    const tokenNome = name.toLowerCase();
    if (window.phaserScene) {
       const token = window.phaserScene.camadaTokens?.list?.find(
                t => (t.charName || t.texture?.key?.replace('tk_', '').split('_')[0]).toLowerCase() === tokenNome.toLowerCase()
            );
        if (token && token.statusText && token.statusText.text) {
            const condDef = CONDICOES.find(c => c.emoji === token.statusText.text);
            if (condDef && !initiativeList.find(e => e.name === name).conditions.find(c => c.id === condDef.id)) {
                initiativeList.find(e => e.name === name).conditions.push({ id: condDef.id });
                renderInitiative();
            }
        }
    }
}

function nextTurn() {
    if (initiativeList.length === 0) return;
    const prevIndex = currentInitIndex;
    currentInitIndex = (currentInitIndex + 1) % initiativeList.length;
    if (currentInitIndex === 0) {
        currentRound++;
        window.currentRound = currentRound;
        document.getElementById('round-counter').textContent = `Round: ${currentRound}`;
    }

    const atual = initiativeList[currentInitIndex];

    // --- PROCESSAR EXPIRAÇÃO DE CONDIÇÕES ---
    if (atual.conditions && atual.conditions.length > 0) {
        atual.conditions = atual.conditions.filter(cond => {
            if (cond.duracao !== undefined) {
                cond.duracao--;
                if (cond.duracao <= 0) {
                    const condDef = CONDICOES.find(c => c.id === cond.id);
                    addChatMessage('⚠ Sistema', `${condDef ? condDef.emoji : ''} <strong>${atual.name}</strong>: condição <strong>${cond.nome || cond.id}</strong> expirou.`, '#94a3b8');
                    return false;
                }
            }
            return true;
        });
    }

    // --- AVISO DE TURNO NO CHAT ---
    const turnoMsg = document.createElement('div');
    turnoMsg.className = 'chat-turn-banner';
    turnoMsg.innerHTML = `⚔ Turno de <strong>${atual.name}</strong>`;
    document.getElementById('chat-log').appendChild(turnoMsg);
    document.getElementById('chat-log').scrollTop = 9999;

    // --- PROCESSAR CONDIÇÕES COM DANO/EFEITO ---
    if (atual.conditions && atual.conditions.length > 0) {
        atual.conditions.forEach(cond => {
            const condId = cond.id || cond;
            const condDef = CONDICOES.find(c => c.id === condId);
            if (!condDef) return;

            const duracaoStr = cond.duracao !== undefined ? ` (${cond.duracao} turnos)` : '';

            if (condDef.danoTurno && condDef.dano) {
                const partes = condDef.dano.split('d');
                const qtd    = parseInt(partes[0]) || 1;
                const lados  = parseInt(partes[1]) || 4;
                let dano = 0;
                for (let i = 0; i < qtd; i++) dano += Math.floor(Math.random() * lados) + 1;

                addChatMessage(
                    '⚠ Sistema',
                    `${condDef.emoji} <strong>${atual.name}</strong> ${condDef.msg}${duracaoStr}: <strong style="color:${condDef.cor}">-${dano} HP</strong>`,
                    condDef.cor
                );
            } else {
                addChatMessage(
                    '⚠ Sistema',
                    `${condDef.emoji} <strong>${atual.name}</strong> ${condDef.msg}${duracaoStr}.`,
                    condDef.cor
                );
            }
        });
    }

    renderInitiative();

    // Abre o chat para o Mestre ver o aviso
    switchTab('chat');
}

function clearInitiative() {
    initiativeList   = [];
    window.initiativeList = initiativeList;
    currentInitIndex = -1;
    currentRound = 1;
    window.currentRound = currentRound;
    document.getElementById('round-counter').textContent = `Round: 1`;
    renderInitiative();
}

// Adiciona uma condição a um combatente
function addConditionToInit(index, condId, duracao = null) {
    const entry = initiativeList[index];
    if (!entry) return;
    const existing = entry.conditions.find(c => c.id === condId);
    if (!existing) {
        const condObj = { id: condId };
        if (duracao !== null) condObj.duracao = duracao;
        entry.conditions.push(condObj);
    }
    renderInitiative();
    document.getElementById('cond-picker-' + index)?.remove();

    const cond = CONDICOES.find(c => c.id === condId);
    if (cond && window.phaserScene) {
        const token = window.phaserScene.camadaTokens?.list?.find(
            t => t.texture?.key?.replace('tk_', '').toLowerCase() === entry.name.toLowerCase()
        );
        if (token) window.phaserScene.setTokenAura(token, cond.cor, cond.emoji);
    }
}

// Remove uma condição de um combatente
function removeConditionFromInit(index, condId) {
    if (!initiativeList[index]) return;
    initiativeList[index].conditions = initiativeList[index].conditions.filter(c => c.id !== condId);
    renderInitiative();
}

function addConditionDialog(index) {
    const entry = initiativeList[index];
    if (!entry) return;
    const anchor = window.event?.currentTarget || document.getElementById('init-tracker');
    openConditionPicker(index, anchor);
}

function removeInitiative(index) {
    if (!initiativeList[index]) return;
    initiativeList.splice(index, 1);
    if (currentInitIndex === index) currentInitIndex = -1;
    else if (index < currentInitIndex) currentInitIndex--;
    renderInitiative();
}

// Abre o seletor de condições flutuante
function openConditionPicker(index, anchorEl) {
    // Fecha qualquer picker aberto
    document.querySelectorAll('.cond-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className  = 'cond-picker';
    picker.id         = 'cond-picker-' + index;
    picker.style.cssText = `
        position: absolute; z-index: 9999;
        background: rgba(10,15,30,0.97);
        border: 1px solid var(--border-color);
        border-radius: 6px; padding: 6px;
        display: flex; flex-direction: column; gap: 4px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        min-width: 160px;
        backdrop-filter: blur(8px);
    `;

    CONDICOES.forEach(cond => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            background: transparent; border: 1px solid rgba(255,255,255,0.08);
            color: ${cond.cor}; border-radius: 4px; padding: 5px 8px;
            cursor: pointer; font-size: 12px; text-align: left;
            transition: background 0.15s;
        `;
        btn.innerHTML = `${cond.emoji} ${cond.label}`;
        btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.06)';
        btn.onmouseleave = () => btn.style.background = 'transparent';
        btn.onclick = (e) => { e.stopPropagation(); addConditionToInit(index, cond.id); };
        picker.appendChild(btn);
    });

    // Posicionar próximo ao botão
    const rect = anchorEl.getBoundingClientRect();
    picker.style.top  = (rect.bottom + 4) + 'px';
    picker.style.left = rect.left + 'px';
    document.body.appendChild(picker);

    // Fechar ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', function closePicker() {
            picker.remove();
            document.removeEventListener('click', closePicker);
        });
    }, 50);
}

        function renderInitiative() {
            const list = document.getElementById('init-list');
            if (!list) return;
            list.innerHTML = '';

            initiativeList.forEach((entry, i) => {
                const item = document.createElement('div');
                item.className = `init-entry ${i === currentInitIndex ? 'active-turn' : ''}`;
                
                const condHtml = entry.conditions.map(c => {
                    const def = CONDICOES.find(cd => cd.id === (c.id || c));
                    return def ? `<span title="${def.label}" style="cursor:help;">${def.emoji}</span>` : '';
                }).join('');

                const durHtml = entry.conditions.map(c => {
                    if (c.duracao !== undefined) return `<span style="font-size:10px;color:var(--accent);">(${c.duracao})</span>`;
                    return '';
                }).join('');

                item.innerHTML = `
                    <div class="init-drag-handle" style="cursor:grab; margin-right:6px; opacity:0.5;">⋮⋮</div>
                    <span class="init-val-badge">${entry.val}</span> 
                    <strong class="init-name">${entry.name}</strong>
                    <span class="init-conditions" style="margin-left:6px;">${condHtml}${durHtml}</span>
                    <div class="init-actions" style="margin-left:auto; display:flex; gap:4px;">
                        <button onclick="addConditionDialog(${i})" title="Adicionar Condição" style="background:transparent;border:none;color:var(--accent);cursor:pointer;font-size:12px;">+</button>
                        <button onclick="removeInitiative(${i})" title="Remover" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:12px;">×</button>
                    </div>
                `;

                item.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    currentInitIndex = i;
                    renderInitiative();
                });

                list.appendChild(item);
            });

            document.getElementById('round-counter').textContent = `Round: ${currentRound}`;
            makeInitiativeDraggable();
        }

        function sortInitiative() {
            initiativeList.sort((a, b) => b.val - a.val);
            renderInitiative();
            addChatMessage('Sistema', 'Ordem de iniciativa reordenada por valor.', '#a78bfa');
        }

function dragInitItem(e, index) {
    e.dataTransfer.setData('text/plain', index);
    e.target.style.opacity = '0.4';
}

function dropInitItem(e, targetIndex) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex === targetIndex) return;
    const moved = initiativeList.splice(fromIndex, 1)[0];
    initiativeList.splice(targetIndex, 0, moved);
    if (currentInitIndex === fromIndex) currentInitIndex = targetIndex;
    else if (fromIndex < currentInitIndex && targetIndex >= currentInitIndex) currentInitIndex--;
    else if (fromIndex > currentInitIndex && targetIndex <= currentInitIndex) currentInitIndex++;
    renderInitiative();
}
