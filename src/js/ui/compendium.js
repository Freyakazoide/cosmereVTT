// Wiki linking from journal/editor fields: smart double click.
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
    if (window.phaserScene && activeTokenForContext) window.phaserScene.bringTokenToFront(activeTokenForContext);
    document.getElementById('context-menu').classList.add('hidden');
}

function contextEnviarTras() {
    if (window.phaserScene && activeTokenForContext) window.phaserScene.sendTokenToBack(activeTokenForContext);
    document.getElementById('context-menu').classList.add('hidden');
}

function ativarRedimensionamento() {
    if (window.phaserScene && activeTokenForContext) window.phaserScene.enterResizeMode(activeTokenForContext);
    document.getElementById('context-menu').classList.add('hidden');
}

let compendioItens = [];
let indexEditandoItem = -1;
const COMPENDIUM_FALLBACK_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='128'><rect width='100%' height='100%' fill='%23111827'/><text x='50%' y='50%' fill='%23fbbf24' font-size='44' text-anchor='middle' dy='.3em' font-family='Arial'>?</text></svg>";

try {
    const salvos = localStorage.getItem('cosmere_compendio');
    if (salvos) compendioItens = JSON.parse(salvos);
} catch (e) { }

function getCompendiumImageSrc(item) {
    return item?.imagem ? '../assets/itens/' + item.imagem : '../assets/itens/default.png';
}

function getCompendiumSummary(item) {
    const obs = String(item?.obs || '').replace(/\s+/g, ' ').trim();
    return obs || 'Arraste para a ficha ou clique para editar.';
}

function abrirModalItem(index = -1) {
    indexEditandoItem = index;
    if (index === -1) {
        document.getElementById('item-name-input').value = '';
        document.getElementById('item-obs-input').value = '';
        document.getElementById('item-image-path').value = '';
        document.getElementById('item-image-preview').src = '../assets/itens/default.png';
    } else {
        const item = compendioItens[index];
        document.getElementById('item-name-input').value = item.nome || '';
        document.getElementById('item-obs-input').value = item.obs || '';
        document.getElementById('item-image-path').value = item.imagem || '';
        document.getElementById('item-image-preview').src = getCompendiumImageSrc(item);
    }
    document.getElementById('item-compendium-modal').classList.remove('hidden');
}

function fecharModalItem() {
    document.getElementById('item-compendium-modal').classList.add('hidden');
}

function salvarItemCompendio() {
    const nome = document.getElementById('item-name-input').value.trim() || 'Novo Item';
    const obs = document.getElementById('item-obs-input').value;
    const imagem = document.getElementById('item-image-path').value.trim();
    const novoItem = { nome, obs, imagem };

    if (indexEditandoItem === -1) {
        compendioItens.push(novoItem);
    } else {
        compendioItens[indexEditandoItem] = novoItem;
    }

    localStorage.setItem('cosmere_compendio', JSON.stringify(compendioItens));
    renderizarCompendio();
    fecharModalItem();
}

function renderizarCompendio() {
    const container = document.getElementById('items-content');
    if (!container) return;

    container.innerHTML = '';

    const controls = document.createElement('div');
    controls.className = 'compendium-toolbar';

    const search = document.createElement('input');
    search.className = 'vtt-input compendium-search';
    search.type = 'text';
    search.id = 'search-compendium';
    search.placeholder = 'Buscar no compendio...';
    search.addEventListener('input', () => filtrarCompendio(search.value));

    const createButton = document.createElement('button');
    createButton.className = 'ui-btn ui-btn--primary btn-create-new';
    createButton.type = 'button';
    createButton.innerHTML = '<i class="fas fa-plus"></i> Criar Novo Item / Arma';
    createButton.addEventListener('click', () => abrirModalItem());

    controls.appendChild(search);
    controls.appendChild(createButton);

    const header = document.createElement('div');
    header.className = 'vtt-category-header';
    header.innerHTML = `<strong>Meu Compendio</strong><span>${compendioItens.length}</span>`;

    const list = document.createElement('div');
    list.className = 'vtt-library-stack compendium-card-list';

    if (compendioItens.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'vtt-empty-state vtt-empty-state--library';
        empty.innerHTML = '<i class="fas fa-book-open"></i><span>Nenhum item no compendio ainda.</span>';
        list.appendChild(empty);
    } else {
        compendioItens.forEach((item, index) => {
            const card = document.createElement('article');
            card.className = 'vtt-library-card vtt-library-card--compendium compendium-item-card';
            card.draggable = true;
            card.dataset.compendiumIndex = String(index);
            card.addEventListener('dragstart', event => dragCompendiumItem(event, index));

            const main = document.createElement('button');
            main.className = 'vtt-library-card__main-action';
            main.type = 'button';
            main.addEventListener('click', () => abrirModalItem(index));

            const preview = document.createElement('div');
            preview.className = 'vtt-library-preview compendium-card-preview';

            const image = document.createElement('img');
            image.src = getCompendiumImageSrc(item);
            image.alt = '';
            image.onerror = () => { image.src = COMPENDIUM_FALLBACK_IMAGE; };
            preview.appendChild(image);

            const content = document.createElement('div');
            content.className = 'vtt-library-card__content';

            const title = document.createElement('strong');
            title.textContent = item.nome || 'Item sem nome';

            const type = document.createElement('small');
            type.textContent = 'Item / Arma';

            const summary = document.createElement('em');
            summary.textContent = getCompendiumSummary(item);

            content.appendChild(title);
            content.appendChild(type);
            content.appendChild(summary);
            main.appendChild(preview);
            main.appendChild(content);

            const actions = document.createElement('div');
            actions.className = 'vtt-library-card__actions';

            const editButton = document.createElement('button');
            editButton.className = 'ui-icon-btn';
            editButton.type = 'button';
            editButton.title = 'Editar item';
            editButton.innerHTML = '<i class="fas fa-pen"></i>';
            editButton.addEventListener('click', () => abrirModalItem(index));

            const deleteButton = document.createElement('button');
            deleteButton.className = 'ui-icon-btn ui-icon-btn--danger';
            deleteButton.type = 'button';
            deleteButton.title = 'Excluir item';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.addEventListener('click', () => deleteCompendiumItem(index));

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);
            card.appendChild(main);
            card.appendChild(actions);
            list.appendChild(card);
        });
    }

    container.appendChild(controls);
    container.appendChild(header);
    container.appendChild(list);
}

renderizarCompendio();

function deleteCompendiumItem(index) {
    compendioItens.splice(index, 1);
    localStorage.setItem('cosmere_compendio', JSON.stringify(compendioItens));
    renderizarCompendio();
}

function filtrarCompendio(termo) {
    termo = (termo || '').toLowerCase();
    const items = document.querySelectorAll('#items-content .compendium-item-card');
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
        equipCont.addEventListener('dragover', (e) => {
            e.preventDefault();
            equipCont.style.borderColor = 'var(--accent)';
        });
        equipCont.addEventListener('dragleave', () => {
            equipCont.style.borderColor = '';
        });
        equipCont.addEventListener('drop', (e) => {
            e.preventDefault();
            equipCont.style.borderColor = '';
            try {
                const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (itemData && itemData.nome) {
                    addEquipamentoFromCompendium(itemData);
                }
            } catch (err) { }
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
