// --- SISTEMAS DE CENAS (MODAIS NATIVOS) ---
        function saveBoard() {
            if(!window.phaserScene) return;
            document.getElementById('scene-name-input').value = '';
            document.getElementById('save-scene-modal').classList.remove('hidden');
            document.getElementById('scene-name-input').focus();
        }

        async function confirmSaveScene() {
            const sceneName = document.getElementById('scene-name-input').value;
            if (!sceneName || sceneName.trim() === '') return;
            
            const state = window.phaserScene.getBoardState();
            state.sceneName = sceneName.trim();
            if (state.sceneDirector && !state.sceneDirector.sceneName) {
                state.sceneDirector.sceneName = state.sceneName;
            }
            await window.api.saveScene(sceneName, JSON.stringify(state));
            addChatMessage("Sistema", `Cena <strong>${sceneName}</strong> salva com sucesso!`, "#22c55e");
            document.getElementById('save-scene-modal').classList.add('hidden');
        }

        async function loadBoard() {
            if(!window.phaserScene) return;
            const scenes = await window.api.loadScenes();
            if(!scenes || scenes.length === 0) {
                addChatMessage("Sistema", "Nenhuma cena encontrada no banco de dados.", "#ef4444");
                return;
            }
            
            const container = document.getElementById('scene-list-container');
            container.innerHTML = scenes.map(s => `
                <div style="background: rgba(0,0,0,0.5); padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #fff; font-weight: bold; font-size: 13px;">${s}</span>
                    <button onclick="confirmLoadScene('${s}')" class="glass-btn primary" style="padding: 6px 12px;">CARREGAR</button>
                </div>
            `).join('');
            
            document.getElementById('load-scene-modal').classList.remove('hidden');
        }

        async function confirmLoadScene(sceneName) {
            const stateJSON = await window.api.loadSceneData(sceneName);
            if(stateJSON) {
                window.phaserScene.loadBoardState(JSON.parse(stateJSON));
                addChatMessage("Sistema", `Mesa carregada: <strong>${sceneName}</strong>`, "#a78bfa");
            }
            document.getElementById('load-scene-modal').classList.add('hidden');
        }

// --- SISTEMA DE VISÃO DE JOGADOR E EXPORTAÇÃO ---
function exportBoard() {
    if(!window.phaserScene) return;
    const state = window.phaserScene.getBoardState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadNode = document.createElement('a');
    downloadNode.setAttribute("href", dataStr);
    downloadNode.setAttribute("download", "mesa_cosmere_" + Date.now() + ".json");
    document.body.appendChild(downloadNode);
    downloadNode.click();
    downloadNode.remove();
    addChatMessage("Sistema", "Mesa exportada para o seu computador (Downloads).", "#34d399");
}

function importBoard() {
    if(!window.phaserScene) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = readerEvent => {
            try {
                const content = readerEvent.target.result;
                const state = JSON.parse(content);
                window.phaserScene.loadBoardState(state);
                addChatMessage("Sistema", "Mesa importada com sucesso via arquivo local!", "#60a5fa");
            } catch (err) {
                addChatMessage("Erro", "Arquivo inválido ou corrompido.", "#ef4444");
            }
        }
    }
    input.click();
}

        // ==========================================
        // SISTEMA DE TOAST (AVISOS VISUAIS)
        // ==========================================
        // SISTEMA DE CROP / PAN E ZOOM DO RETRATO
