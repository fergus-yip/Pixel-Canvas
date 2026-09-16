/**
 * Creature shelf storage.
 * Prefers IndexedDB (larger quota). Falls back to localStorage if IDB is missing or fails.
 * Frames are stored sparse so empty cells do not bloat JSON.
 */
(function (root) {
    'use strict';

    var DB_NAME = 'pixel-canvas';
    var DB_VERSION = 1;
    var PROJECTS = 'projects';
    var META = 'meta';
    var LS_KEY = 'pixel-canvas-shelf-v2';
    var LEGACY_KEY = 'pixel-canvas-project-v1';
    var SHELF_MAX = 16;

    var db = null;
    var mode = 'idb';

    function reqToPromise(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function openIdb() {
        return new Promise(function (resolve, reject) {
            if (!root.indexedDB) {
                reject(new Error('no idb'));
                return;
            }
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function () {
                var next = req.result;
                if (!next.objectStoreNames.contains(PROJECTS)) {
                    next.createObjectStore(PROJECTS, { keyPath: 'id' });
                }
                if (!next.objectStoreNames.contains(META)) {
                    next.createObjectStore(META, { keyPath: 'key' });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function readLs() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || { currentId: null, projects: {} };
        } catch (err) {
            return { currentId: null, projects: {} };
        }
    }

    function writeLs(state) {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
    }

    function packFrames(frames, gridW, gridH) {
        gridW = gridW || gridH;
        gridH = gridH || gridW;
        return frames.map(function (frame) {
            var cells = [];
            for (var y = 0; y < gridH; y++) {
                for (var x = 0; x < gridW; x++) {
                    if (frame[y] && frame[y][x]) cells.push(x, y, frame[y][x]);
                }
            }
            return cells;
        });
    }

    function unpackFrames(packed, gridW, gridH) {
        gridW = gridW || gridH;
        gridH = gridH || gridW;
        return (packed || []).map(function (cells) {
            var frame = [];
            for (var y = 0; y < gridH; y++) {
                frame[y] = [];
                for (var x = 0; x < gridW; x++) frame[y][x] = null;
            }
            if (Array.isArray(cells) && cells.length && typeof cells[0] === 'object' && cells[0] !== null) {
                for (var r = 0; r < gridH; r++) {
                    for (var c = 0; c < gridW; c++) {
                        frame[r][c] = (cells[r] && cells[r][c]) || null;
                    }
                }
                return frame;
            }
            for (var i = 0; i + 2 < cells.length; i += 3) {
                var px = cells[i];
                var py = cells[i + 1];
                var color = cells[i + 2];
                if (py >= 0 && py < gridH && px >= 0 && px < gridW) frame[py][px] = color;
            }
            return frame;
        });
    }

    function packData(data) {
        var gridW = data.gridWidth || data.gridSize;
        var gridH = data.gridHeight || data.gridSize;
        return {
            version: data.version,
            gridSize: gridW === gridH ? gridW : data.gridSize,
            gridWidth: gridW,
            gridHeight: gridH,
            currentFrameIndex: data.currentFrameIndex,
            isAnimationEnabled: data.isAnimationEnabled,
            recentColors: data.recentColors || data.customColors || [],
            fps: data.fps,
            currentStep: data.currentStep,
            packedFrames: packFrames(data.frames, gridW, gridH)
        };
    }

    function unpackData(data) {
        if (!data) return data;
        var first = Array.isArray(data.frames) ? data.frames[0] : null;
        var inferredH = Array.isArray(first) ? first.length : 0;
        var inferredW = Array.isArray(first && first[0]) ? first[0].length : inferredH;
        var gridW = data.gridWidth || data.gridSize || inferredW || 18;
        var gridH = data.gridHeight || data.gridSize || inferredH || 18;
        if (Array.isArray(data.frames)) {
            return Object.assign({}, data, {
                gridWidth: data.gridWidth || gridW,
                gridHeight: data.gridHeight || gridH
            });
        }
        return {
            version: data.version,
            gridSize: gridW === gridH ? gridW : undefined,
            gridWidth: gridW,
            gridHeight: gridH,
            frames: unpackFrames(data.packedFrames, gridW, gridH),
            currentFrameIndex: data.currentFrameIndex,
            isAnimationEnabled: data.isAnimationEnabled,
            recentColors: data.recentColors || data.customColors || [],
            fps: data.fps,
            currentStep: data.currentStep
        };
    }

    async function prune(keepId) {
        var items = await list();
        if (items.length <= SHELF_MAX) return;
        var extras = items.filter(function (p) { return p.id !== keepId; });
        extras.sort(function (a, b) { return a.updatedAt - b.updatedAt; });
        var removeCount = items.length - SHELF_MAX;
        for (var i = 0; i < removeCount && i < extras.length; i++) {
            await remove(extras[i].id);
        }
    }

    async function save(record) {
        record = Object.assign({}, record, { updatedAt: Date.now() });
        if (mode === 'idb' && db) {
            try {
                var tx = db.transaction(PROJECTS, 'readwrite');
                await reqToPromise(tx.objectStore(PROJECTS).put(record));
                await prune(record.id);
                return record;
            } catch (err) {
                if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
                    await prune(record.id);
                    try {
                        var tx2 = db.transaction(PROJECTS, 'readwrite');
                        await reqToPromise(tx2.objectStore(PROJECTS).put(record));
                        return record;
                    } catch (err2) {
                        throw err2;
                    }
                }
                throw err;
            }
        }
        var state = readLs();
        state.projects[record.id] = record;
        try {
            writeLs(state);
        } catch (err) {
            var ids = Object.keys(state.projects).sort(function (a, b) {
                return (state.projects[a].updatedAt || 0) - (state.projects[b].updatedAt || 0);
            }).filter(function (id) { return id !== record.id; });
            if (!ids.length) throw err;
            delete state.projects[ids[0]];
            state.projects[record.id] = record;
            writeLs(state);
        }
        var count = Object.keys(readLs().projects).length;
        if (count > SHELF_MAX) await prune(record.id);
        return record;
    }

    async function load(id) {
        if (!id) return null;
        if (mode === 'idb' && db) {
            var tx = db.transaction(PROJECTS, 'readonly');
            return reqToPromise(tx.objectStore(PROJECTS).get(id));
        }
        return readLs().projects[id] || null;
    }

    async function list() {
        if (mode === 'idb' && db) {
            var tx = db.transaction(PROJECTS, 'readonly');
            var rows = await reqToPromise(tx.objectStore(PROJECTS).getAll());
            return (rows || []).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
        }
        var projects = readLs().projects;
        return Object.keys(projects).map(function (id) { return projects[id]; })
            .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    }

    async function remove(id) {
        if (mode === 'idb' && db) {
            var tx = db.transaction(PROJECTS, 'readwrite');
            await reqToPromise(tx.objectStore(PROJECTS).delete(id));
            return;
        }
        var state = readLs();
        delete state.projects[id];
        if (state.currentId === id) state.currentId = null;
        writeLs(state);
    }

    async function getCurrentId() {
        if (mode === 'idb' && db) {
            var tx = db.transaction(META, 'readonly');
            var row = await reqToPromise(tx.objectStore(META).get('currentId'));
            return row && row.value;
        }
        return readLs().currentId;
    }

    async function setCurrentId(id) {
        if (mode === 'idb' && db) {
            var tx = db.transaction(META, 'readwrite');
            await reqToPromise(tx.objectStore(META).put({ key: 'currentId', value: id }));
            return;
        }
        var state = readLs();
        state.currentId = id;
        writeLs(state);
    }

    async function open() {
        try {
            db = await openIdb();
            mode = 'idb';
        } catch (err) {
            db = null;
            mode = 'ls';
        }
        var legacy = null;
        try { legacy = localStorage.getItem(LEGACY_KEY); } catch (err) { legacy = null; }
        if (legacy) {
            try {
                var data = JSON.parse(legacy);
                var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                var rec = {
                    id: id,
                    name: 'Untitled',
                    updatedAt: Date.now(),
                    thumb: '',
                    data: packData(data)
                };
                await save(rec);
                await setCurrentId(id);
                localStorage.removeItem(LEGACY_KEY);
            } catch (err) {
                console.warn('Legacy migrate skipped', err);
            }
        }
        return mode;
    }

    root.PixelStore = {
        open: open,
        save: save,
        load: load,
        list: list,
        remove: remove,
        getCurrentId: getCurrentId,
        setCurrentId: setCurrentId,
        packData: packData,
        unpackData: unpackData,
        SHELF_MAX: SHELF_MAX,
        mode: function () { return mode; }
    };
})(typeof self !== 'undefined' ? self : this);
