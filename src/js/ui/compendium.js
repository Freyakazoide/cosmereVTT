// WIKI LINKADA NO DIÁRIO: Duplo clique inteligente
        document.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
                const text = e.target.value;
                const pos = e.target.selectionStart;
                
                let start = pos;
                while (start > 0 && !/\s/.test(text[start - 1])) start--;
                let end = pos;
                while (end < text.length && !/\s/.test(text[end])) end++;
                
                const word = text.substring(start, end);
                if (word.startsWith('@')) {
                    const nome = word.substring(1).replace(/[^a-zA-ZÀ-ÿ0-9_]/g, '');
                    if (nome && window.abrirFicha) abrirFicha(nome);
                }
            }
        });

        function contextTrazerFrente() {
            if(window.phaserScene && activeTokenForContext) window.phaserScene.bringTokenToFront(activeTokenForContext);
            document.getElementById('context-menu').classList.add('hidden');
        }

        function contextEnviarTras() {
            if(window.phaserScene && activeTokenForContext) window.phaserScene.sendTokenToBack(activeTokenForContext);
            document.getElementById('context-menu').classList.add('hidden');
        }

        function ativarRedimensionamento() {
            if(window.phaserScene && activeTokenForContext) window.phaserScene.enterResizeMode(activeTokenForContext);
            document.getElementById('context-menu').classList.add('hidden');
        }

       let compendioItens = [];
        let indexEditandoItem = -1;

        // Tenta carregar os itens salvos ao iniciar a página
        try {
            const salvos = localStorage.getItem('cosmere_compendio');
            if (salvos) compendioItens = JSON.parse(salvos);
        } catch(e) { }

        function abrirModalItem(index = -1) {
            indexEditandoItem = index;
            if (index === -1) {
                document.getElementById('item-name-input').value = '';
                document.getElementById('item-obs-input').value = '';
                document.getElementById('item-image-path').value = '';
                document.getElementById('item-image-preview').src = '../assets/itens/default.png';
            } else {
                const item = compendioItens[index];
                document.getElementById('item-name-input').value = item.nome;
                document.getElementById('item-obs-input').value = item.obs;
                document.getElementById('item-image-path').value = item.imagem;
                document.getElementById('item-image-preview').src = '../assets/itens/' + (item.imagem || 'default.png');
            }
            document.getElementById('item-compendium-modal').classList.remove('hidden');
        }

        function fecharModalItem() {
            document.getElementById('item-compendium-modal').classList.add('hidden');
        }

        function salvarItemCompendio() {
            const nome = document.getElementById('item-name-input').value.trim() || 'Novo Item';
            const obs = document.getElementById('item-obs-input').value;
            const imagem = document.getElementById('item-image-path').value;

            const novoItem = { nome, obs, imagem };

            if (indexEditandoItem === -1) {
                compendioItens.push(novoItem);
            } else {
                compendioItens[indexEditandoItem] = novoItem;
            }

            // Salva de verdade no armazenamento local
            localStorage.setItem('cosmere_compendio', JSON.stringify(compendioItens));
            
            renderizarCompendio();
            fecharModalItem();
        }

        function renderizarCompendio() {
            const container = document.getElementById('items-content');
            
            container.innerHTML = `
                <button class="btn-create-new" onclick="abrirModalItem()">
                    <i class="fas fa-plus"></i> Criar Novo Item / Arma
                </button>
                <div class="category-header">Meu Compêndio</div>
            `;

            compendioItens.forEach((item, index) => {
                container.innerHTML += `
                    <div class="list-item" draggable="true" ondragstart="dragCompendiumItem(event, ${index})" style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.4); margin-bottom: 5px; border-radius: 4px;">
                        <span onclick="abrirModalItem(${index})" style="flex:1; cursor:pointer; padding: 5px;">
                            <i class="fas fa-box" style="color: var(--accent); margin-right: 8px;"></i> ${item.nome}
                        </span>
                        <button class="glass-btn danger" style="padding: 4px 8px; font-size: 10px;" onclick="deleteCompendiumItem(${index})"><i class="fas fa-trash"></i></button>
                    </div>
                `;
            });
        }

        // Chama a renderização logo de cara para exibir os itens que já estavam salvos
        renderizarCompendio();

        function deleteCompendiumItem(index) {
            compendioItens.splice(index, 1);
            localStorage.setItem('cosmere_compendio', JSON.stringify(compendioItens));
            renderizarCompendio();
        }

        function filtrarCompendio(termo) {
            termo = termo.toLowerCase();
            const items = document.querySelectorAll('#items-content .list-item');
            items.forEach(item => {
                item.style.display = item.innerText.toLowerCase().includes(termo) ? '' : 'none';
            });
        }

        function dragCompendiumItem(e, index) {
            e.dataTransfer.setData('text/plain', JSON.stringify(compendioItens[index]));
        }

        document.addEventListener('DOMContentLoaded', () => {
            const equipCont = document.getElementById('equipment-container');
            if (equipCont) {
                equipCont.addEventListener('dragover', (e) => { e.preventDefault(); equipCont.style.borderColor = 'var(--accent)'; });
                equipCont.addEventListener('dragleave', () => { equipCont.style.borderColor = ''; });
                equipCont.addEventListener('drop', (e) => {
                    e.preventDefault();
                    equipCont.style.borderColor = '';
                    try {
                        const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (itemData && itemData.nome) {
                            addEquipamentoFromCompendium(itemData);
                        }
                    } catch(err) {}
                });
            }
        });

        function addEquipamentoFromCompendium(item) {
            const container = document.getElementById('equipment-container');
            const div = document.createElement('div');
            div.className = 'char-card card-fisico slot-weapon';
            div.innerHTML = `
                <button class="btn-delete-item" onclick="prepararDelecao(this)"><i class="fas fa-trash"></i></button>
                <label><i class="fas fa-box"></i> ${item.nome}</label>
                <input type="text" value="${item.nome}" class="item-name">
                <div class="slot-desc"><input type="text" value="${item.obs || ''}" style="font-size:12px; color:var(--accent); font-family: 'Segoe UI', sans-serif;"></div>
            `;
            container.appendChild(div);
            calcularPeso();
            addChatMessage('Sistema', `Item <strong>${item.nome}</strong> adicionado ao equipamento.`, '#22c55e');
        }
