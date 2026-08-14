// Developer/player stats panel. Replaces the legacy browser alert with compact in-game UI.
(() => {
    function isRu() {
        return typeof stats !== 'undefined' && stats.language !== 'en';
    }

    function isDevStatsEnabled() {
        return window.heartDevMode === true
            && typeof window.heartDevForceFirstPlaythrough === 'function'
            && window.heartDevForceFirstPlaythrough();
    }

    function canShowStats() {
        const authorized = typeof stats !== 'undefined' && stats.isAuthorized === true;
        return authorized || isDevStatsEnabled();
    }

    function syncStatsDevVisibility() {
        document.documentElement.classList.toggle('heart-dev-first-playthrough', isDevStatsEnabled());
        if (!canShowStats()) closeStatsPanel();
    }

    function statSnapshot() {
        const relationships = (typeof stats !== 'undefined' && stats.relationships) || {};
        return {
            crown: Number(stats?.crown) || 0,
            heart: Number(stats?.heart) || 0,
            leaf: Number(stats?.leaf) || 0,
            diamonds: Number(stats?.diamonds) || 0,
            relationships: {
                mark: Number(relationships.mark) || 0,
                lera: Number(relationships.lera) || 0,
                vika: Number(relationships.vika) || 0,
                sergey: Number(relationships.sergey) || 0,
                anna: Number(relationships.anna) || 0,
                dima: Number(relationships.dima) || 0,
                lyosha: Number(relationships.lyosha) || 0
            }
        };
    }

    function closeStatsPanel() {
        document.getElementById('stats-panel-overlay')?.remove();
    }

    function createValueRow(label, value) {
        const row = document.createElement('div');
        row.className = 'stats-panel-row';

        const name = document.createElement('span');
        name.className = 'stats-panel-label';
        name.textContent = label;

        const number = document.createElement('strong');
        number.className = 'stats-panel-value';
        number.textContent = String(value);

        row.append(name, number);
        return row;
    }

    function showStatsPanel() {
        closeStatsPanel();
        if (!canShowStats()) return false;

        const ru = isRu();
        const snapshot = statSnapshot();
        const overlay = document.createElement('div');
        overlay.id = 'stats-panel-overlay';
        overlay.className = 'stats-panel-overlay';
        overlay.setAttribute('role', 'presentation');

        const panel = document.createElement('section');
        panel.className = 'stats-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-labelledby', 'stats-panel-title');

        const header = document.createElement('div');
        header.className = 'stats-panel-header';

        const title = document.createElement('h2');
        title.id = 'stats-panel-title';
        title.textContent = ru ? 'Статы' : 'Stats';

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'stats-panel-close';
        close.setAttribute('aria-label', ru ? 'Закрыть' : 'Close');
        close.textContent = '×';
        close.addEventListener('click', closeStatsPanel);
        header.append(title, close);

        const primary = document.createElement('div');
        primary.className = 'stats-panel-section stats-panel-primary';
        primary.append(
            createValueRow(ru ? 'Короны' : 'Crowns', snapshot.crown),
            createValueRow(ru ? 'Сердце' : 'Heart', snapshot.heart),
            createValueRow(ru ? 'Лист' : 'Leaf', snapshot.leaf),
            createValueRow(ru ? 'Бриллианты' : 'Diamonds', snapshot.diamonds)
        );

        const relationsTitle = document.createElement('h3');
        relationsTitle.textContent = ru ? 'Отношения' : 'Relationships';

        const relationships = document.createElement('div');
        relationships.className = 'stats-panel-section stats-panel-relationships';
        const labels = ru
            ? { mark: 'Марк', lera: 'Лера', vika: 'Вика', sergey: 'Сергей', anna: 'Анна', dima: 'Дима', lyosha: 'Лёша' }
            : { mark: 'Mark', lera: 'Lera', vika: 'Vika', sergey: 'Sergey', anna: 'Anna', dima: 'Dima', lyosha: 'Lesha' };
        Object.entries(labels).forEach(([id, label]) => {
            relationships.appendChild(createValueRow(label, snapshot.relationships[id]));
        });

        panel.append(header, primary, relationsTitle, relationships);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        close.focus();
        return true;
    }

    function installStatsButton() {
        const original = document.getElementById('stats');
        if (!original) return;

        // foundation.js historically attaches an alert()-based handler during DOMContentLoaded.
        // Clone the button once to discard that legacy listener without coupling this UI to foundation internals.
        const button = original.cloneNode(true);
        original.replaceWith(button);
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            showStatsPanel();
        });

        if (window.heartDevMode === true) {
            document.documentElement.classList.add('heart-dev-mode');
        }

        syncStatsDevVisibility();
        const devCheckbox = document.querySelector('#stage0k-dev-replay-control input[type="checkbox"]');
        devCheckbox?.addEventListener('change', syncStatsDevVisibility);
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.getElementById('stats-panel-overlay')) {
            closeStatsPanel();
        }
    });

    document.addEventListener('DOMContentLoaded', installStatsButton);
    window.heartShowStatsPanel = showStatsPanel;
    window.heartCloseStatsPanel = closeStatsPanel;
    window.heartSyncStatsVisibility = syncStatsDevVisibility;
})();
