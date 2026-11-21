(() => {
    'use strict';

    const web = window.RatParadiseWeb;
    const menu = document.querySelector('#start-menu');
    const launch = document.querySelector('#launch');
    const canvas = document.querySelector('#unity-canvas');
    const receiver = 'Rat Paradise Start Menu';
    let instance, state, page = 'home', target, backup;

    web.showMenu = data => {
        if (!data.entered && (!state || state.entered)) goHome();
        state = data;
        if (instance) draw();
    };
    web.connectMenu = player => { instance = player; if (state) draw(); };
    web.backMenu = () => {
        if (!state || state.entered || state.busy) return;
        if (page === 'load') go('home');
        else if (page === 'protect') go(target === 0 ? 'home' : 'load');
        else if (page === 'save') go('protect');
        else if (page === 'overwrite') go('save');
    };

    function go(next) {
        page = next;
        draw();
        document.querySelector('#start-card').scrollTop = 0;
    }

    function goHome() {
        page = 'home';
        target = backup = null;
        document.querySelector('#start-card').scrollTop = 0;
    }

    function choose(next) {
        target = next;
        if (state.hasAutosave) go('protect');
        else sendSwitch(0, false);
    }

    function sendSwitch(slot, confirmed) {
        instance.SendMessage(receiver, 'SwitchColony', [target, slot, confirmed ? 'confirmed' : ''].join(','));
    }

    function draw() {
        document.querySelector('#progress').hidden = true;
        document.querySelector('#loading-message').hidden = true;
        launch.hidden = state.entered;
        if (state.entered) {
            canvas.focus({ preventScroll: true });
            return;
        }
        menu.hidden = false;
        menu.replaceChildren();
        if (state.error) add('p', state.error, menu, 'menu-error').setAttribute('role', 'alert');
        if (state.busy) {
            add('p', 'Saving and opening the colony…', menu).setAttribute('role', 'status');
            return;
        }
        if (state.error && state.canContinue && page !== 'home')
            button(menu, 'Continue Current Colony', () => instance.SendMessage(receiver, 'ContinueColony'), 'secondary');

        switch (page) {
            case 'home': {
                const resume = button(menu, 'Continue', () => instance.SendMessage(receiver, 'ContinueColony'), 'continue', !state.canContinue);
                const summary = add('p', state.summary || 'No autosave yet.', menu, 'menu-summary');
                summary.id = 'autosave-summary';
                resume.setAttribute('aria-describedby', summary.id);
                const row = add('div', null, menu, 'menu-row');
                button(row, 'New Game', () => choose(0), 'peach');
                button(row, 'Load Game', () => go('load'), 'lilac');
                break;
            }
            case 'load':
                add('h2', 'Load Game', menu);
                slots('Load', (index) => choose(index), slot => !slot.canLoad);
                button(menu, 'Back', () => go('home'), 'secondary');
                break;
            case 'protect': {
                add('h2', target === 0 ? 'Start a new colony?' : `Load Slot ${target}?`, menu);
                add('p', (target === 0 ? 'Starting a new game' : `Loading Slot ${target}`) +
                    ' replaces the current autosave. You can keep a copy in a manual slot.', menu);
                const row = add('div', null, menu, 'menu-row');
                button(row, 'Cancel', () => go(target === 0 ? 'home' : 'load'), 'secondary');
                button(row, 'Save Current Colony to a Slot', () => go('save'), '', !state.canContinue);
                button(row, target === 0 ? 'Start New Game' : `Load Slot ${target}`, () => sendSwitch(0, true), 'warning');
                break;
            }
            case 'save':
                add('h2', 'Save current colony to a slot', menu);
                if (target) add('p', `Slot ${target} holds the colony you are about to load.`, menu);
                slots('Save', (index, slot) => {
                    if (!slot.occupied) sendSwitch(index, false);
                    else { backup = index; go('overwrite'); }
                }, (_, index) => target === index);
                button(menu, 'Back', () => go('protect'), 'secondary');
                break;
            case 'overwrite':
                confirm(`Replace the snapshot in Slot ${backup}?`, 'Save', () => sendSwitch(backup, true), 'save');
                break;
        }
    }

    function confirm(message, label, action, cancel) {
        add('h2', 'Are you sure?', menu);
        add('p', message, menu);
        const row = add('div', null, menu, 'menu-row');
        button(row, 'Cancel', () => go(cancel), 'secondary');
        button(row, label, action);
    }

    function slots(label, action, disabled) {
        const list = add('div', null, menu, 'slot-list');
        state.slots.forEach((slot, i) => {
            const index = i + 1;
            const row = add('div', null, list, 'save-slot');
            const detail = add('div', null, row);
            add('strong', `Slot ${index}${slot.occupied ? '' : ' · Empty'}`, detail);
            if (slot.timestamp) add('p', slot.timestamp, detail);
            if (slot.summary || slot.error) add('p', slot.error || slot.summary, detail);
            const control = button(row, label, () => action(index, slot), '', disabled(slot, index));
            control.setAttribute('aria-label', `${label} Slot ${index}`);
        });
    }

    function button(parent, label, action, style, disabled = false) {
        const control = add('button', label, parent, style);
        control.type = 'button';
        control.disabled = disabled;
        control.addEventListener('click', action);
        return control;
    }

    function add(tag, text, parent, style) {
        const element = document.createElement(tag);
        if (text !== null) element.textContent = text;
        if (style) element.className = style;
        parent.appendChild(element);
        return element;
    }
})();
