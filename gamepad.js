(() => {
    'use strict';
    const web = window.RatParadiseWeb;
    const launch = document.querySelector('#launch');
    const menu = document.querySelector('#start-menu');
    let previousId = 0, previousMask = 0, waitForNeutral = true;
    let heldDirection = 0, nextRepeat = 0;
    const bits = {a: 1, b: 2, up: 1 << 12, down: 1 << 13, left: 1 << 14, right: 1 << 15};

    web.readGamepad = () => {
        if (document.hidden || !document.hasFocus()) return null;
        let pads;
        try { pads = navigator.getGamepads?.(); }
        catch (error) {
            if (error.name === 'SecurityError') return null;
            throw error;
        }
        if (!pads) return null;
        for (const pad of pads) {
            if (!pad?.connected || pad.mapping !== 'standard') continue;
            let mask = 0;
            for (let i = 0; i < 16; ++i)
                if (pad.buttons[i]?.pressed) mask |= 1 << i;
            return {id: pad.index + 1, moveX: pad.axes[0] || 0, moveY: -(pad.axes[1] || 0),
                lookX: pad.axes[2] || 0, lookY: -(pad.axes[3] || 0), mask};
        }
        return null;
    };

    function clearFocus() {
        delete menu.dataset.padFocus;
        menu.querySelector('.gamepad-hint')?.remove();
    }
    function mode() {
        menu.dataset.padFocus = 'true';
        if (menu.querySelector('.gamepad-hint')) return;
        const hint = document.createElement('div');
        hint.className = 'gamepad-hint';
        hint.textContent = 'D-pad / Left stick  Move   ·   A  Select   ·   B  Back';
        menu.append(hint);
    }
    function navigate(buttons, focus, direction) {
        if (!focus) return buttons[0];
        const start = focus.getBoundingClientRect();
        const x = start.x + start.width / 2, y = start.y + start.height / 2;
        let score = Infinity, best = focus;
        for (const node of buttons) {
            if (node === focus) continue;
            const at = node.getBoundingClientRect();
            const dx = at.x + at.width / 2 - x, dy = at.y + at.height / 2 - y;
            const horizontal = direction === bits.left || direction === bits.right;
            const advance = (horizontal ? dx : dy) * (direction === bits.left || direction === bits.up ? -1 : 1);
            if (advance < 4) continue;
            const cost = advance + Math.abs(horizontal ? dy : dx) * 3;
            if (cost < score) { score = cost; best = node; }
        }
        return best;
    }

    function tick(time) {
        requestAnimationFrame(tick);
        if (launch.hidden || menu.hidden) { previousId = 0; return; }
        const pad = web.readGamepad();
        if (!pad) { previousId = 0; heldDirection = 0; clearFocus(); return; }
        if (pad.id !== previousId) {
            previousId = pad.id;
            previousMask = 0;
            heldDirection = 0;
            waitForNeutral = true;
        }
        const stick = Math.max(Math.abs(pad.moveX), Math.abs(pad.moveY));
        let direction = pad.mask & (bits.up | bits.down | bits.left | bits.right);
        if (!direction && stick >= .53)
            direction = Math.abs(pad.moveX) > Math.abs(pad.moveY) ?
                (pad.moveX < 0 ? bits.left : bits.right) : (pad.moveY > 0 ? bits.up : bits.down);
        let down = pad.mask & ~previousMask;
        const inputSeen = down || direction;
        previousMask = pad.mask;
        if (waitForNeutral) {
            waitForNeutral = pad.mask !== 0 || stick >= .4;
            if (waitForNeutral) down = direction = 0;
        }
        if (!inputSeen && !menu.dataset.padFocus) return;
        const buttons = [...menu.querySelectorAll('button:enabled')];
        if (!buttons.length) return;
        mode();
        const focused = menu.contains(document.activeElement) ? document.activeElement : null;
        if (!focused) buttons[0].focus();
        if (down & bits.b) { web.backMenu(); return; }
        if (down & bits.a) { (focused || buttons[0]).click(); return; }
        if (direction && (direction !== heldDirection || time >= nextRepeat)) {
            const next = navigate(buttons, focused, direction);
            if (next) { next.focus({preventScroll:true}); next.scrollIntoView({block:'nearest', inline:'nearest'}); }
            nextRepeat = time + (direction === heldDirection ? 110 : 325);
        }
        heldDirection = direction;
    }

    window.addEventListener('pointerdown', clearFocus);
    window.addEventListener('keydown', clearFocus);
    window.addEventListener('blur', () => { previousId = 0; clearFocus(); });
    requestAnimationFrame(tick);
})();
