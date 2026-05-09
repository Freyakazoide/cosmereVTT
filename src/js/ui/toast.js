// ==========================================
        function mostrarToast(msg, tipo = 'success', icone = 'fa-check-circle') {
            const toast = document.createElement('div');
            toast.className = `toast-msg ${tipo}`;
            toast.innerHTML = `<i class="fas ${icone}"></i> ${msg}`;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.4s';
                setTimeout(() => toast.remove(), 400);
            }, 2500);
        }

        // --- MODAIS ARRASTÁVEIS ---
        function makeDraggable(modalId, handleSelector) {
            const modal = document.getElementById(modalId);
            const handle = modal.querySelector(handleSelector);
            if (!handle) return;

            let isDragging = false, offsetX = 0, offsetY = 0;

            handle.style.cursor = 'move';
            handle.addEventListener('mousedown', (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                isDragging = true;
                const glass = modal.querySelector('.sheet-glass') || modal;
                const rect = glass.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                glass.classList.add('dragging');
                modal.style.justifyContent = 'flex-start';
                modal.style.alignItems = 'flex-start';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const glass = modal.querySelector('.sheet-glass') || modal;
                glass.style.left = (e.clientX - offsetX) + 'px';
                glass.style.top = (e.clientY - offsetY) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    const glass = modal.querySelector('.sheet-glass') || modal;
                    glass.classList.remove('dragging');
                }
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            // Removido o drag da ficha para evitar congelamento de campos SELECT e TEXTAREA
            makeDraggable('image-viewer-modal', '#image-viewer-modal');
        });
