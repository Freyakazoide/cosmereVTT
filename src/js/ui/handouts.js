// Lógica de Visualização (Imagem e Vídeo)
        let currentHandoutPayload = null;
        window.revealedHandouts = window.revealedHandouts || [];

        function mostrarImagem(path) {
            const modal = document.getElementById('image-viewer-modal');
            const img = document.getElementById('viewer-img-src');
            const video = document.getElementById('viewer-video-src');
            currentHandoutPayload = { type: 'image', path, title: path.split(/[\\/]/).pop() };
            
            video.classList.add('hidden');
            video.pause();
            
            img.src = `file://${path}`;
            img.classList.remove('hidden');
            modal.classList.remove('hidden');
            addChatMessage("Mestre", `Exibiu uma imagem para o grupo.`, "#a78bfa");
        }

        function mostrarVideo(path, autoPlay = true) {
            const modal = document.getElementById('image-viewer-modal');
            const img = document.getElementById('viewer-img-src');
            const video = document.getElementById('viewer-video-src');
            currentHandoutPayload = { type: 'video', path, title: path.split(/[\\/]/).pop() };
            
            img.classList.add('hidden');
            
            if (path.startsWith('http://') || path.startsWith('https://')) {
                let existingIframe = modal.querySelector('#yt-iframe');
                if (existingIframe) existingIframe.remove();
                
                let embedUrl = path;
                if (path.includes('youtube.com/watch')) {
                    const videoId = new URL(path).searchParams.get('v');
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                } else if (path.includes('youtu.be/')) {
                    const videoId = path.split('youtu.be/')[1].split('?')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                }
                
                const iframe = document.createElement('iframe');
                iframe.id = 'yt-iframe';
                iframe.src = embedUrl;
                iframe.style.cssText = 'width:80vw; height:80vh; border:1px solid var(--accent); border-radius:4px;';
                iframe.allow = 'autoplay; encrypted-media';
                iframe.allowFullscreen = true;
                modal.insertBefore(iframe, modal.firstChild);
                video.classList.add('hidden');
                video.pause();
            } else {
                const existingIframe = modal.querySelector('#yt-iframe');
                if (existingIframe) existingIframe.remove();
                
                video.src = `file://${path}`;
                video.classList.remove('hidden');
                
                if (autoPlay) video.play();
            }
            
            modal.classList.remove('hidden');
            addChatMessage("Mestre", `Iniciou uma cena de vídeo.`, "#a78bfa");
        }

        function showCurrentHandoutLocally() {
            if (!currentHandoutPayload) return;
            rememberRevealedHandout(currentHandoutPayload);
            addChatMessage("Sistema", "Pergaminho marcado como revelado.", "#38bdf8");
        }

        function showHandoutPathLocally(path, type = 'image', title = '') {
            if (!path) return;
            const payload = {
                type,
                path,
                title: title || path.split(/[\\/]/).pop()
            };
            if (type === 'video') {
                mostrarVideo(path);
            } else {
                mostrarImagem(path);
            }
            rememberRevealedHandout(payload);
            addChatMessage("Sistema", "Pergaminho aberto na mesa.", "#38bdf8");
        }

        function rememberRevealedHandout(payload) {
            if (!payload || !payload.path) return;
            window.revealedHandouts = (window.revealedHandouts || []).filter(h => h.path !== payload.path);
            window.revealedHandouts.push({
                ...payload,
                revealedAt: new Date().toISOString()
            });
        }

        function closeRevealedHandoutsLocally() {
            window.revealedHandouts = [];
            fecharViewer();
            addChatMessage("Sistema", "Pergaminho ocultado da mesa.", "#94a3b8");
        }

        function fecharViewer() {
            const modal = document.getElementById('image-viewer-modal');
            const video = document.getElementById('viewer-video-src');
            video.pause();
            const iframe = modal.querySelector('#yt-iframe');
            if (iframe) iframe.remove();
            modal.classList.add('hidden');
        }
