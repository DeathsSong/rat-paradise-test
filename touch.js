(() => {
    'use strict';

    const canvas = document.querySelector('#unity-canvas');
    const touch = navigator.maxTouchPoints > 0 && matchMedia('(any-pointer: coarse)').matches;
    const room = 0, scroll = 1, drag = 2, touchPanel = 3;
    let mode = room;
    let gesture = null;
    const clicks = [];
    let pressedClick = null;
    let clickTimer = null;
    const worldContacts = new Map();
    const worldTaps = [];
    const scrollEvents = [];

    window.RatParadiseWeb = {
        touch,
        setPointerMode(next) {
            if (next !== mode) interrupt();
            mode = next;
        },
        readWorldTap() {
            return worldTaps.shift() || null;
        },
        readScroll() { return scrollEvents.shift(); },
        saveResult(error) {
            const notice = document.querySelector('#save-error');
            notice.hidden = !error;
            notice.textContent = error ? 'This browser could not save the colony. Check browser storage.' : '';
        }
    };
    if (!touch) return;

    function clearWorldTaps() {
        worldContacts.clear();
        worldTaps.length = 0;
    }

    function interrupt() {
        clearWorldTaps();
        cancelClicks();
        if (gesture?.dragging && mode === drag) mouse('mouseup', gesture.x, gesture.y, 0);
        gesture = null;
        scrollEvents.length = 0;
        scrollEvents.push([3, 0, 0, 0]);
    }

    document.addEventListener('fullscreenchange', interrupt);
    document.addEventListener('visibilitychange', interrupt);
    new ResizeObserver(interrupt).observe(canvas);

    function scrollPoint(type, x, y, time) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        scrollEvents.push([type, (x - rect.left) / rect.width, (y - rect.top) / rect.height, time * .001]);
    }

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
                worldTaps.push([start.x / rect.width, start.y / rect.height, x / rect.width, y / rect.height]);
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

    function releaseClick() {
        if (pressedClick) mouse('mouseup', pressedClick.x, pressedClick.y, 0);
        pressedClick = null;
    }

    function cancelClicks() {
        if (clickTimer !== null) clearTimeout(clickTimer);
        clickTimer = null;
        clicks.length = 0;
        releaseClick();
    }

    function playNextClick() {
        clickTimer = null;
        if (!clicks.length || (mode === drag && gesture?.dragging)) return;
        pressedClick = clicks.shift();
        mouse('mousemove', pressedClick.x, pressedClick.y, 0);
        mouse('mousedown', pressedClick.x, pressedClick.y, 1);
        // Give Unity a player frame for each edge, including the release
        // between consecutive touches.
        clickTimer = setTimeout(() => {
            releaseClick();
            clickTimer = setTimeout(playNextClick, 55);
        }, 100);
    }

    const options = { capture: true, passive: false };
    canvas.addEventListener('touchstart', event => {
        if (!menuTouch(event) || gesture) return;
        const finger = event.changedTouches[0];
        gesture = { id: finger.identifier, startX: finger.clientX, startY: finger.clientY,
            x: finger.clientX, y: finger.clientY, dragging: false };
        if (mode === scroll) scrollPoint(0, finger.clientX, finger.clientY, event.timeStamp);
    }, options);

    canvas.addEventListener('touchmove', event => {
        if (!menuTouch(event) || !gesture) return;
        const finger = Array.from(event.changedTouches).find(value => value.identifier === gesture.id);
        if (!finger) return;
        const x = finger.clientX, y = finger.clientY;
        if (!gesture.dragging && Math.hypot(x - gesture.startX, y - gesture.startY) >= 7) {
            gesture.dragging = true;
            if (mode === drag) {
                if (pressedClick) releaseClick();
                mouse('mousedown', gesture.startX, gesture.startY, 1);
            }
        }
        if (gesture.dragging) {
            if (mode === drag) mouse('mousemove', x, y, 1);
            else if (mode === scroll) scrollPoint(1, x, y, event.timeStamp);
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
        const dragged = previous.dragging || Math.hypot(finger.clientX - previous.startX, finger.clientY - previous.startY) >= 7;
        if (previous.dragging && mode === drag) {
            mouse('mouseup', finger.clientX, finger.clientY, 0);
            if (clickTimer === null && clicks.length) clickTimer = setTimeout(playNextClick, 55);
        }
        if (mode === scroll) scrollPoint(event.type === 'touchcancel' || !dragged ? 3 : 2,
            finger.clientX, finger.clientY, event.timeStamp);
        if (dragged || event.type === 'touchcancel') return;
        clicks.push({x: finger.clientX, y: finger.clientY});
        if (clickTimer === null) playNextClick();
    }

    canvas.addEventListener('touchend', finish, options);
    canvas.addEventListener('touchcancel', finish, options);
})();
