(function initToolbarTooltips() {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tool-btn[title]:not([data-tooltip])').forEach(btn => {
            btn.dataset.tooltip = btn.getAttribute('title');
        });
    });
})();
