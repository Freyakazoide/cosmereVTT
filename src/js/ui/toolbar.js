(function initToolbarTooltips() {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tool-btn[title]:not([data-tooltip])').forEach(btn => {
            const label = btn.getAttribute('title');
            btn.dataset.tooltip = label;
            btn.setAttribute('aria-label', label);
            btn.removeAttribute('title');
        });
    });
})();
