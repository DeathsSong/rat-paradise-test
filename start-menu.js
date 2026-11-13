(() => {
    'use strict';

    const web = window.RatParadiseWeb;
    const menu = document.querySelector('#start-menu');
    const launch = document.querySelector('#launch');
    const canvas = document.querySelector('#unity-canvas');
    const receiver = 'Rat Paradise Start Menu';
    let instance, state, page = 'home', target, backup;

    web.showMenu = data => { state = data; if (instance) draw(); };
    web.connectMenu = player => { instance = player; if (state) draw(); };

    function go(next) {
        page = next;
        draw();
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
        if (state.entered) {
            launch.hidden = true;
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
                add('p', state.summary || 'No active colony yet.', menu, 'menu-summary');
                const row = add('div', null, menu, 'menu-row');
                button(row, 'Continue', () => instance.SendMessage(receiver, 'ContinueColony'), '', !state.canContinue);
                button(row, 'New Game', () => choose(0));
                button(row, 'Load Game', () => go('load'), 'secondary');
                break;
            }
            case 'load':
                add('h2', 'Load Game', menu);
                slots('Load', (index) => choose(index), slot => !slot.canLoad);
                button(menu, 'Back', () => go('home'), 'secondary');
                break;
            case 'protect': {
                add('h2', 'Save your current colony?', menu);
                add('p', target === 0 ? 'Starting a new game replaces the current autosave.' :
                    `Loading Slot ${target} replaces the current autosave.`, menu);
                const row = add('div', null, menu, 'menu-row');
                button(row, 'Save Current Colony', () => go('save'), '', !state.canContinue);
                button(row, target === 0 ? 'Start Without Saving' : 'Load Without Saving', () => go('skip'), 'warning');
                button(row, 'Cancel', () => go(target === 0 ? 'home' : 'load'), 'secondary');
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
            case 'skip':
                confirm('Your current autosave will be replaced. Your manual slots will stay as they are.',
                    target === 0 ? 'Start New Game' : `Load Slot ${target}`, () => sendSwitch(0, true), 'protect');
                break;
        }
    }

    function confirm(message, label, action, cancel) {
        add('h2', 'Are you sure?', menu);
        add('p', message, menu);
        const row = add('div', null, menu, 'menu-row');
        button(row, 'Cancel', () => go(cancel), 'secondary');
        button(row, label, action, page === 'skip' ? 'warning' : '');
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
