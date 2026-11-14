(() => {
    'use strict';

    const canvas = document.querySelector('#unity-canvas');
    const touch = navigator.maxTouchPoints > 0 && matchMedia('(any-pointer: coarse)').matches;
    const room = 0, scroll = 1, drag = 2, touchPanel = 3;
    let mode = room;
    let gesture = null;
    let tapPending = false;
    const worldContacts = new Map();
    let worldTap = null;

    window.RatParadiseWeb = {
        touch,
        setPointerMode(next) {
            if (next !== mode) clearWorldTaps();
            if (next !== mode && gesture) {
                if (gesture.dragging && mode === drag) mouse('mouseup', gesture.x, gesture.y, 0);
                gesture = null;
            }
            mode = next;
        },
        readWorldTap() {
            const tap = worldTap;
            worldTap = null;
            return tap;
        },
        saveResult(error) {
            const notice = document.querySelector('#save-error');
            notice.hidden = !error;
            notice.textContent = error ? 'This browser could not save the colony. Check browser storage.' : '';
        }
    };
    if (!touch) return;

    function clearWorldTaps() {
        worldContacts.clear();
        worldTap = null;
    }

    document.addEventListener('fullscreenchange', clearWorldTaps);
    document.addEventListener('visibilitychange', clearWorldTaps);
    new ResizeObserver(clearWorldTaps).observe(canvas);

    function worldTouch(event) {
        const rect = canvas.getBoundingClientRect();
        for (const finger of event.changedTouches) {
            const id = finger.identifier;
            const x = finger.clientX - rect.left;
            const y = finger.clientY - rect.top;
            if (event.type === 'touchstart') {
                worldContacts.set(id, { x, y, time: event.timeStamp, dragged: false });
                continue;
            }
            const start = worldContacts.get(id);
            if (!start) continue;
            if (Math.hypot(x - start.x, y - start.y) > 9) start.dragged = true;
            if (event.type === 'touchmove') continue;
            worldContacts.delete(id);
            if (event.type === 'touchend' && !start.dragged && event.timeStamp - start.time <= 420 && rect.width && rect.height)
                worldTap = [start.x / rect.width, start.y / rect.height, x / rect.width, y / rect.height];
        }
    }

    function mouse(type, x, y, buttons) {
        canvas.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons
        }));
    }

    function menuTouch(event) {
        if (mode === room) {
            worldTouch(event);
            return false;
        }
        if (mode === touchPanel) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
    }

    const options = { capture: true, passive: false };
    canvas.addEventListener('touchstart', event => {
        if (!menuTouch(event) || gesture || tapPending) return;
        const finger = event.changedTouches[0];
        gesture = { id: finger.identifier, startX: finger.clientX, startY: finger.clientY,
            x: finger.clientX, y: finger.clientY, dragging: false };
    }, options);

    canvas.addEventListener('touchmove', event => {
        if (!menuTouch(event) || !gesture) return;
        const finger = Array.from(event.changedTouches).find(value => value.identifier === gesture.id);
        if (!finger) return;
        const x = finger.clientX, y = finger.clientY;
        if (!gesture.dragging && Math.hypot(x - gesture.startX, y - gesture.startY) >= 7) {
            gesture.dragging = true;
            if (mode === drag) mouse('mousedown', gesture.startX, gesture.startY, 1);
            else if (mode === scroll) mouse('mousemove', gesture.startX, gesture.startY, 0);
        }
        if (gesture.dragging) {
            if (mode === drag) mouse('mousemove', x, y, 1);
            else if (mode === scroll) canvas.dispatchEvent(new WheelEvent('wheel', {
                bubbles: true, cancelable: true, clientX: gesture.startX, clientY: gesture.startY,
                deltaY: (gesture.y - y) * 3.5, deltaMode: WheelEvent.DOM_DELTA_PIXEL
            }));
        }
        gesture.x = x;
        gesture.y = y;
    }, options);

    function finish(event) {
        if (!menuTouch(event) || !gesture) return;
        const finger = Array.from(event.changedTouches).find(value => value.identifier === gesture.id);
        if (!finger) return;
        const previous = gesture;
        gesture = null;
        if (previous.dragging && mode === drag) mouse('mouseup', finger.clientX, finger.clientY, 0);
        if (previous.dragging || event.type === 'touchcancel') return;
        const x = finger.clientX, y = finger.clientY;
        tapPending = true;
        mouse('mousemove', x, y, 0);
        mouse('mousedown', x, y, 1);
        // Unity polls the mouse button once per player frame. Keep it down
        // long enough for a touch click to register on slower phones.
        setTimeout(() => {
            mouse('mouseup', x, y, 0);
            tapPending = false;
        }, 100);
    }

    canvas.addEventListener('touchend', finish, options);
    canvas.addEventListener('touchcancel', finish, options);
})();
