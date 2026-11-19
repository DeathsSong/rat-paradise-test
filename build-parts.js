// Unity receives the original compressed byte stream. Pages serves each content-addressed part as a regular file.
window.installParadiseDataParts = function (config, parts) {
    if (!parts) return () => {};
    const data = new URL(config.dataUrl, document.baseURI);
    const original = window.fetch;
    const fetchFile = original.bind(window);
    const size = parts.reduce((total, part) => total + part.size, 0);
    const previousCache = config.cacheControl;
    config.cacheControl = url => new URL(url, document.baseURI).href === data.href ? 'no-store' :
        previousCache ? previousCache(url) : 'no-store';
    window.fetch = function (input, options) {
        const url = input instanceof Request ? input.url : String(input);
        if (new URL(url, document.baseURI).href !== data.href) return fetchFile(input, options);
        let index = 0, reader, partBytes = 0;
        const headers = { 'Content-Length': String(size), 'Content-Type': 'application/octet-stream' };
        const signal = options?.signal || (input instanceof Request ? input.signal : undefined);
        const stream = new ReadableStream({
            async pull(controller) {
                if (!reader) {
                    if (index === parts.length) { controller.close(); return; }
                    const response = await fetchFile(new URL(parts[index].file, data), { signal });
                    if (!response.ok || !response.body) throw new Error('Could not load game data part ' + (index + 1));
                    reader = response.body.getReader();
                    partBytes = 0;
                }
                const next = await reader.read();
                if (next.done) {
                    if (partBytes !== parts[index].size) throw new Error('Incomplete game data part ' + (index + 1));
                    reader.releaseLock();
                    reader = null;
                    index++;
                    // The consumer may be waiting with an empty queue at the part boundary.
                    return this.pull(controller);
                }
                partBytes += next.value.byteLength;
                controller.enqueue(next.value);
            },
            cancel(reason) { return reader?.cancel(reason); }
        });
        return Promise.resolve(new Response(stream, { headers }));
    };
    return () => { window.fetch = original; };
};
