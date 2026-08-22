function sendPing(x, y) {
    if (!window.phaserScene) return;
    const scene = window.phaserScene;
    if (!scene.pingGraphics) {
        scene.pingGraphics = scene.add.graphics();
    }
    const worldPoint = scene.cameras.main.getWorldPoint(x, y);
    scene.pingGraphics.clear();
    scene.pingGraphics.lineStyle(4, 0xfbbf24, 1);
    scene.pingGraphics.strokeCircle(worldPoint.x, worldPoint.y, 20);
    scene.tweens.add({ targets: scene.pingGraphics, alpha: 0, duration: 2000, onComplete: () => scene.pingGraphics.clear() });

    addChatMessage('Sistema', `Ping enviado em (${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)})`, '#fbbf24');
}

let mapLocked = true;

function applyMapLockState(locked) {
    mapLocked = Boolean(locked);
    const btn = document.getElementById('btn-map-lock');
    if (btn) {
        btn.innerHTML = mapLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-lock-open"></i>';
        btn.classList.toggle('active', mapLocked);
    }
    if (window.phaserScene) {
        window.phaserScene.mapLocked = mapLocked;
        window.phaserScene.mudarFerramenta?.(window.phaserScene.ferramentaAtual || 'select');
    }
}

function toggleMapLock() {
    applyMapLockState(!mapLocked);
    window.markSceneDirty?.('map-lock');
    addChatMessage('Sistema', mapLocked ? 'Mapa travado.' : 'Mapa destravado.', '#60a5fa');
}

function restoreMapLockState(locked) {
    applyMapLockState(locked);
}

window.restoreMapLockState = restoreMapLockState;
document.addEventListener('DOMContentLoaded', () => applyMapLockState(mapLocked));

let selectedTokens = [];
function handleTokenMultiSelect(token) {
    if (!selectedTokens.includes(token)) {
        selectedTokens.push(token);
        token.setTint(0x00ff00);
    } else {
        selectedTokens = selectedTokens.filter(t => t !== token);
        token.clearTint();
    }
    addChatMessage('Sistema', `${selectedTokens.length} tokens selecionados.`, '#60a5fa');
}

function clearTokenSelection() {
    selectedTokens.forEach(t => t.clearTint());
    selectedTokens = [];
}
