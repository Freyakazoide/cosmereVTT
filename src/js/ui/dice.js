// Sistema de Chat e Dados Integrado
        let chatLog = [];

        function addChatMessage(user, msg, color = "#fff") {
            const msgProcessada = msg.replace(/@([a-zA-ZÀ-ÿ0-9_]+)/g, `<span style="color: var(--accent); cursor: pointer; text-decoration: underline; font-weight: bold; padding: 0 2px;" onclick="if(window.abrirFicha) abrirFicha('$1')">@$1</span>`);

            const log = document.getElementById('chat-log');
            const entry = document.createElement('div');
            entry.style.background = "rgba(255,255,255,0.03)";
            entry.style.padding = "6px 10px";
            entry.style.borderRadius = "4px";
            entry.innerHTML = `<strong style="color:var(--accent)">${user}:</strong> <span style="color:${color}">${msgProcessada}</span>`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;

            chatLog.push({ user, msg, color, timestamp: Date.now() });
            if (chatLog.length > 200) chatLog = chatLog.slice(-200);
            try { localStorage.setItem('cosmere_chat', JSON.stringify(chatLog)); } catch(e) {}
        }

       function rollDice() {
            const qty = parseInt(document.getElementById('dice-qty').value) || 1;
            const faces = parseInt(document.getElementById('dice-type').value) || 20;
            const baseVol = document.getElementById('audio-volume') ? document.getElementById('audio-volume').value : 0.5;
            const vol = getMasterVolume() * parseFloat(baseVol);
            
            let total = 0;
            let results = [];
            let isCritSuccess = false;
            let isCritFail = false;

            for(let i = 0; i < qty; i++) {
                const roll = Math.floor(Math.random() * faces) + 1;
                results.push(roll);
                total += roll;
                if (faces === 20 && roll === 20) isCritSuccess = true;
                if (faces === 20 && roll === 1) isCritFail = true;
            }

            const mainAudio = new Audio('../assets/dados/dados.mp3');
            mainAudio.volume = vol;
            mainAudio.play().catch(err => console.error("Erro ao tocar dados.mp3:", err));

            if (isCritSuccess || isCritFail) {
                setTimeout(() => {
                    const extraPath = isCritSuccess ? '../assets/dados/critico.mp3' : '../assets/dados/falha_critica.mp3';
                    const extraAudio = new Audio(extraPath);
                    extraAudio.volume = vol;
                    extraAudio.play().catch(err => console.error("Erro ao tocar som crítico:", err));
                }, 600);
            }

            if (isCritSuccess || isCritFail) {
                const flash = document.createElement('div');
                flash.className = `crit-overlay ${isCritSuccess ? 'crit-success-flash' : 'crit-fail-flash'}`;
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 2000);
            }

            mostrarDadosNaTela(results, faces);
            
            const diceStr = results.length > 1 ? ` <span style="font-size:10px; color:#94a3b8;">[${results.join(', ')}]</span>` : '';
            addChatMessage("Sistema", `Rolou <strong>${qty}d${faces}</strong>: <span style="font-size:16px; color:var(--accent)">${total}</span>${diceStr}`, isCritSuccess ? "gold" : (isCritFail ? "#ef4444" : "#fbbf24"));
        }

        function mostrarDadosNaTela(results, faces) {
            let tray = document.getElementById('dice-tray');
            if (!tray) {
                tray = document.createElement('div');
                tray.id = 'dice-tray';
                tray.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index: 9999; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); backdrop-filter:blur(10px); border:1px solid rgba(251,191,36,0.3); padding:30px; border-radius:20px; box-shadow:0 0 50px rgba(0,0,0,0.9); pointer-events:all; transition: opacity 0.4s; max-width: 90vw; max-height: 80vh; overflow: hidden;';
                document.body.appendChild(tray);
            }
            
            tray.style.opacity = '1';
            tray.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center; margin-bottom:30px; overflow:hidden; max-height: 60vh; padding: 10px;" id="dice-container-inner"></div>
                <button class="glass-btn danger" onclick="this.parentElement.style.opacity='0'; setTimeout(()=>this.parentElement.remove(), 400)" style="padding:10px 30px;">FECHAR RESULTADO</button>
            `;

            const diceColor = localStorage.getItem('dice-color') || '#fbbf24';
            const inner = document.getElementById('dice-container-inner');
            results.forEach((res, index) => {
                const dadoVisual = document.createElement('div');
                dadoVisual.className = 'dice-visual';
                dadoVisual.style.setProperty('--dice-color', diceColor);
                dadoVisual.style.color = (faces === 20 && res === 20) ? "gold" : (faces === 20 && res === 1) ? "#ff4444" : diceColor;
                dadoVisual.innerText = res;
                dadoVisual.style.animationDelay = `${index * 0.1}s`;
                inner.appendChild(dadoVisual);
            });

            setTimeout(() => {
                if (tray && tray.parentElement) {
                    tray.style.transition = 'opacity 0.5s';
                    tray.style.opacity = '0';
                    setTimeout(() => { if (tray && tray.parentElement) tray.remove(); }, 500);
                }
            }, 8000);
        }

        // Handler do Input do Chat
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = e.target.value;
                if (!val) return;
                
                const chatTarget = document.getElementById('chat-target') ? document.getElementById('chat-target').value : 'todos';
                
                if (val.startsWith('/r ')) {
                    const rollStr = val.replace('/r ', '');
                    const modMatch = rollStr.match(/(\d+)d(\d+)([+-]\d+)?/);
                    if (modMatch) {
                        const qty = parseInt(modMatch[1]) || 1;
                        const faces = parseInt(modMatch[2]) || 20;
                        const mod = modMatch[3] ? parseInt(modMatch[3]) : 0;
                        let total = 0;
                        for(let i=0; i<qty; i++) total += (Math.floor(Math.random() * faces) + 1);
                        total += mod;
                        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                        const prefix = chatTarget === 'mestre' ? '[🔒 Privado] ' : '';
                        addChatMessage("Mestre", `${prefix}Rolagem (${rollStr}): <strong>${total}</strong> <span style="font-size:10px;color:#94a3b8;">(mod ${modStr})</span>`, "#a78bfa");
                    } else {
                        addChatMessage("Erro", "Formato inválido. Use: /r 1d20+5", "#ef4444");
                    }
                } else {
                    const prefix = chatTarget === 'mestre' ? '[🔒 Privado] ' : '';
                    addChatMessage("Mestre", `${prefix}${val}`);
                }
                e.target.value = '';
            }
        });

function loadChatHistory() {
    try {
        const savedChat = localStorage.getItem('cosmere_chat');
        if (savedChat) {
            chatLog = JSON.parse(savedChat);
            const log = document.getElementById('chat-log');
            log.innerHTML = '';
            chatLog.forEach(entry => {
                const div = document.createElement('div');
                div.style.background = "rgba(255,255,255,0.03)";
                div.style.padding = "6px 10px";
                div.style.borderRadius = "4px";
                const msgProc = entry.msg.replace(/@([a-zA-Z?-?0-9_]+)/g, `<span style="color: var(--accent); cursor: pointer; text-decoration: underline; font-weight: bold; padding: 0 2px;" onclick="if(window.abrirFicha) abrirFicha('$1')">@$1</span>`);
                div.innerHTML = `<strong style="color:var(--accent)">${entry.user}:</strong> <span style="color:${entry.color}">${msgProc}</span>`;
                log.appendChild(div);
            });
            log.scrollTop = log.scrollHeight;
        }
    } catch(e) { console.error("Erro ao carregar chat", e); }
}

window.addEventListener('DOMContentLoaded', loadChatHistory);
