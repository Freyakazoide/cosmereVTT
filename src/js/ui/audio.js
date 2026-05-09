// Sistema de Música Pro Multitrack
        let currentAudio = null;
        let isPaused = false;
        let fadeInterval = null;

        document.addEventListener('DOMContentLoaded', () => {
            const masterVol = document.getElementById('master-volume');
            if (masterVol) {
                masterVol.addEventListener('input', function() {
                    const val = parseFloat(this.value);
                    document.getElementById('master-volume-display').textContent = `${Math.round(val * 100)}%`;
                    if (currentAudio) currentAudio.volume = val * (document.getElementById('audio-volume')?.value || 0.4);
                    Object.values(ambientAudios).forEach(a => { a.volume = val * 0.5; });
                });
            }
        });

        function getMasterVolume() {
            const mv = document.getElementById('master-volume');
            return mv ? parseFloat(mv.value) : 1.0;
        }

        function playMusic(caminhoAbsoluto, nome) {
            const oldAudio = currentAudio;
            const newAudio = new Audio(`file://${caminhoAbsoluto}`);
            newAudio.loop = true;
            newAudio.volume = 0;

            if (oldAudio && !oldAudio.paused) {
                const masterVol = getMasterVolume();
                const baseVol = document.getElementById('audio-volume').value;
                let fadeOutVol = oldAudio.volume;
                let fadeInVol = 0;
                const targetVol = masterVol * baseVol;
                const step = 0.05;

                if (fadeInterval) clearInterval(fadeInterval);
                fadeInterval = setInterval(() => {
                    fadeOutVol = Math.max(0, fadeOutVol - step);
                    fadeInVol = Math.min(targetVol, fadeInVol + step);
                    oldAudio.volume = fadeOutVol;
                    newAudio.volume = fadeInVol;

                    if (fadeOutVol <= 0 && fadeInVol >= targetVol - step) {
                        clearInterval(fadeInterval);
                        fadeInterval = null;
                        oldAudio.pause();
                        oldAudio.removeEventListener('timeupdate', updateProgressUI);
                        newAudio.volume = targetVol;
                    }
                }, 100);
            }

            currentAudio = newAudio;
            document.getElementById('current-track-name').innerText = nome.replace(/\.[^/.]+$/, "");
            document.getElementById('play-pause-icon').className = 'fas fa-pause';
            isPaused = false;

            currentAudio.play().catch(e => console.error("Erro:", e));
            addChatMessage("Sistema", `Tocando: 🎵 ${nome.replace(/\.[^/.]+$/, "")}`, "#60a5fa");

            currentAudio.addEventListener('timeupdate', updateProgressUI);
        }

        function updateProgressUI() {
            if (!currentAudio) return;
            const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
            document.getElementById('audio-progress').value = progress;
        }

        document.getElementById('audio-progress').oninput = function() {
            if (!currentAudio) return;
            const time = (this.value / 100) * currentAudio.duration;
            currentAudio.currentTime = time;
        };

        function togglePauseMusic() {
            if (!currentAudio) return;
            const icon = document.getElementById('play-pause-icon');
            const trackName = document.getElementById('current-track-name');
            if (isPaused) {
                currentAudio.play();
                icon.className = 'fas fa-pause';
                if (trackName) trackName.classList.remove('paused-indicator');
                isPaused = false;
            } else {
                currentAudio.pause();
                icon.className = 'fas fa-play';
                if (trackName) trackName.classList.add('paused-indicator');
                isPaused = true;
            }
        }

function updateVolume(val) {
            if (currentAudio) currentAudio.volume = getMasterVolume() * parseFloat(val);
        }

        // Como o JS perde a referência na array seca, vamos usar um Objeto para gerenciar faixas extras
        let ambientAudios = {}; 

        function tocarJunto(caminhoAbsoluto, nome) {
            const name = nome.replace(/\.[^/.]+$/, "");
            if (ambientAudios[name]) return; 
            
            const bgm = new Audio(`file://${caminhoAbsoluto}`);
            bgm.loop = true;
            bgm.volume = getMasterVolume() * 0.5;
            bgm.play().catch(e => console.error("Erro:", e));
            ambientAudios[name] = bgm;
            
            addChatMessage("Sistema", `Som adicionado à mesa: 🎵 ${name}`, "#60a5fa");
            renderActiveTracks();
        }

        function renderActiveTracks() {
            const container = document.getElementById('active-tracks-ui');
            const tracks = Object.keys(ambientAudios);
            
            if (tracks.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = '<div style="font-size: 10px; color: var(--accent); margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">ÁUDIOS SOBREPOSTOS</div>' + 
            tracks.map(t => `
                <div style="background: rgba(0,0,0,0.5); padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px;">
                    <span style="flex:1; font-size:11px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fas fa-layer-group" style="color:var(--accent); margin-right:4px;"></i> ${t}</span>
                    <input type="range" min="0" max="1" step="0.01" value="${ambientAudios[t].volume}" oninput="ambientAudios['${t}'].volume = this.value" style="width: 50px; accent-color: var(--accent);">
                    <button onclick="pararTrack('${t}')" class="glass-btn danger" style="padding: 4px 6px; font-size: 10px;"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }

        function pararTrack(name) {
            if (ambientAudios[name]) {
                ambientAudios[name].pause();
                delete ambientAudios[name];
                renderActiveTracks();
            }
        }

        function stopMusic() {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                document.getElementById('current-track-name').innerText = "Nenhuma faixa tocando";
            }
            
            Object.values(ambientAudios).forEach(a => { a.pause(); });
            ambientAudios = {};
            renderActiveTracks();
            
            addChatMessage("Sistema", "Todo o áudio parado.", "#ef4444");
        }
