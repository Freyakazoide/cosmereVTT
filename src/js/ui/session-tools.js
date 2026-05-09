function syncPointer(x, y, color, playerName) {
            let pointer = document.getElementById('player-pointer');
            if (!pointer) {
                pointer = document.createElement('div');
                pointer.id = 'player-pointer';
                pointer.style.cssText = 'position:fixed; width:12px; height:12px; border-radius:50%; pointer-events:none; z-index:9999; transition: all 0.3s ease-out; box-shadow: 0 0 8px currentColor;';
                document.body.appendChild(pointer);
            }
            pointer.style.left = x + 'px';
            pointer.style.top = y + 'px';
            pointer.style.backgroundColor = color;
            pointer.style.color = color;
            pointer.title = playerName;
            clearTimeout(pointer._timeout);
            pointer._timeout = setTimeout(() => { if (pointer && pointer.parentElement) pointer.remove(); }, 3000);
        }

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
            if (window.api && window.api.syncPing) {
                window.api.syncPing({ x: worldPoint.x, y: worldPoint.y });
            }
            
            addChatMessage('Sistema', `📍 Ping enviado em (${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)})`, '#fbbf24');
        }

        let mapLocked = localStorage.getItem('cosmere-map-locked') === 'true';
        function toggleMapLock() {
            mapLocked = !mapLocked;
            localStorage.setItem('cosmere-map-locked', mapLocked);
            const btn = document.getElementById('btn-map-lock');
            if (btn) {
                btn.innerHTML = mapLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-lock-open"></i>';
                btn.classList.toggle('active', mapLocked);
            }
            if (window.phaserScene) {
                window.phaserScene.mapLocked = mapLocked;
            }
            addChatMessage('Sistema', mapLocked ? 'Mapa travado para jogadores.' : 'Mapa destravado.', '#60a5fa');
        }

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
