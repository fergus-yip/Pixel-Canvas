document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const STORAGE_KEY = 'pixel-canvas-project-v1';
    const PROJECT_VERSION = 2;
    const STICKER_SIZE = 512;
    const MAX_HISTORY = 40;
    const MAX_FRAMES = 10;
    const MAX_GRID_SIDE = 512;
    const RATIOS = [
        { id: '1:1', a: 1, b: 1 },
        { id: '2:3', a: 2, b: 3 },
        { id: '4:5', a: 4, b: 5 },
        { id: '16:9', a: 16, b: 9 }
    ];
    const DENSITIES = [
        { id: '16', short: 16 },
        { id: '32', short: 32 },
        { id: '64', short: 64 },
        { id: '128', short: 128 },
        { id: '256', short: 256 }
    ];
    const INK = '#1A1714';
    const PAPER = '#F4F0E6';
    const DEFAULT_PAINT = '#D67A32';
    const THEME = {
        paper: PAPER,
        ink: INK,
        checkA: '#EDEAE3',
        checkB: '#D8D3C8',
        gridPaper: '#C9C2B3',
        gridCheck: 'rgba(26, 23, 20, 0.22)'
    };
    const HINTS = {
        1: 'Draw a closed ink silhouette. Ink stays locked.',
        2: 'Color fills the inside. Fill only works in a closed shape.',
        3: 'Publish a sticker or GIF. Backup is a file you can Open.'
    };

    const canvas = document.getElementById('pixelCanvas');
    const ctx = canvas.getContext('2d');

    const colorGroups = [
        { name: 'Paper', colors: ['#F4F0E6', '#C9C2B3', '#6F6A60'] },
        { name: 'Black', colors: ['#B8B4B0', '#4F4C49', '#2F2D2B'] },
        { name: 'Skin', colors: ['#F3D2B3', '#E0A07A', '#B56A4A'] },
        { name: 'Brown', colors: ['#CFA67A', '#8B5A32', '#4E2F1C'] },
        { name: 'Red', colors: ['#F0A09A', '#D4453E', '#7A1F1C'] },
        { name: 'Orange', colors: ['#F0C49A', '#D67A32', '#7A4314'] },
        { name: 'Yellow', colors: ['#F0E29A', '#D4B02A', '#7A6810'] },
        { name: 'Green', colors: ['#A8D4A0', '#3F9A4A', '#1E4E28'] },
        { name: 'Teal', colors: ['#9FCFC8', '#2F8F86', '#164E4A'] },
        { name: 'Blue', colors: ['#A3C6EA', '#3A78C4', '#1E3F72'] },
        { name: 'Violet', colors: ['#C4B4E4', '#6B56B8', '#34286A'] },
        { name: 'Berry', colors: ['#E4A8C8', '#C44A86', '#6E2450'] }
    ];

    let gridW = 64;
    let gridH = 64;
    let pixelSize = 1;
    let showGrid = true;
    let isDrawing = false;
    let currentTool = 'draw';
    let currentColor = INK;
    let currentStep = 1;
    let frames = [createEmptyFrame(64, 64)];
    let currentFrameIndex = 0;
    let isAnimationEnabled = false;
    let recentColors = [];
    let pressTimer = null;
    let longPressFired = false;
    let pressCell = null;
    let history = [];
    let historyIndex = -1;
    let previewInterval = null;
    let isOnionEnabled = false;
    let persistTimer = null;
    let strokeDirty = false;
    let activeHue = 0;
    let currentId = '';
    let projectName = 'Untitled';
    let viewScale = 1;
    let viewX = 0;
    let viewY = 0;
    let pinch = null;
    let spaceDown = false;
    let panning = false;
    let panStart = null;
    let deferredPrompt = null;
    let lastTap = null;
    let pendingTap = null;
    let zoomHintShown = false;
    let newCanvasPick = { ratio: '1:1', orientation: 'square', density: '64' };
    let newCanvasResolver = null;
    let newCanvasAllowCancel = true;
    let lastDrawStep = 1;
    let lastPaintColor = DEFAULT_PAINT;
    let lastStrokeCell = null;
    let toastTimer = null;
    let insideMask = null;

    const els = {
        app: document.getElementById('app'),
        bezel: document.getElementById('bezel'),
        hint: document.getElementById('hint'),
        undo: document.getElementById('undoBtn'),
        redo: document.getElementById('redoBtn'),
        grid: document.getElementById('gridToggleBtn'),
        animToggle: document.getElementById('animToggle'),
        filmstrip: document.getElementById('filmstrip'),
        copyPrev: document.getElementById('copyPrevBtn'),
        onion: document.getElementById('onionBtn'),
        currentColor: document.getElementById('currentColor'),
        colorPicker: document.getElementById('colorPicker'),
        palette: document.getElementById('colorPalette'),
        customColors: document.getElementById('customColors'),
        overlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        emptyState: document.getElementById('emptyState'),
        shareBtn: document.getElementById('shareBtn'),
        fps: document.getElementById('fps'),
        preview: document.getElementById('previewBtn'),
        exportGif: document.getElementById('exportGifBtn'),
        gifCard: document.getElementById('gifCard'),
        gifHint: document.getElementById('gifHint'),
        gifExtras: document.getElementById('gifExtras'),
        saveAll: document.getElementById('saveAllBtn'),
        fileInput: document.getElementById('fileInput'),
        projectInput: document.getElementById('projectInput'),
        moreBtn: document.getElementById('moreBtn'),
        moreSheet: document.getElementById('moreSheet'),
        backdrop: document.getElementById('backdrop'),
        libraryBtn: document.getElementById('libraryBtn'),
        libraryRoot: document.getElementById('libraryRoot'),
        libraryClose: document.getElementById('libraryClose'),
        projectNameInput: document.getElementById('projectNameInput'),
        sideNameInput: document.getElementById('sideNameInput'),
        sideLibraryBtn: document.getElementById('sideLibraryBtn'),
        brandName: document.getElementById('brandName'),
        shelfGrid: document.getElementById('shelfGrid'),
        storageNote: document.getElementById('storageNote'),
        newProjectBtn: document.getElementById('newProjectBtn'),
        deleteProjectBtn: document.getElementById('deleteProjectBtn'),
        canvasStage: document.getElementById('canvasStage'),
        gridOverlay: document.getElementById('gridOverlay'),
        zoomReset: document.getElementById('zoomReset'),
        librarySaveBtn: document.getElementById('librarySaveBtn'),
        libraryOpenBtn: document.getElementById('libraryOpenBtn'),
        colorFab: document.getElementById('colorFab'),
        focusBtn: document.getElementById('focusBtn'),
        focusPeek: document.getElementById('focusPeek'),
        paletteClose: document.getElementById('paletteClose'),
        drawModeBtn: document.getElementById('drawModeBtn'),
        exportHudBtn: document.getElementById('exportHudBtn'),
        installBtn: document.getElementById('installBtn'),
        sizeChip: document.getElementById('sizeChip'),
        pngHint: document.getElementById('pngHint'),
        newCanvasRoot: document.getElementById('newCanvasRoot'),
        newCanvasShape: document.getElementById('newCanvasShape'),
        newCanvasLabel: document.getElementById('newCanvasLabel'),
        ratioRow: document.getElementById('ratioRow'),
        orientRow: document.getElementById('orientRow'),
        densityRow: document.getElementById('densityRow'),
        newCanvasCancel: document.getElementById('newCanvasCancel'),
        newCanvasCreate: document.getElementById('newCanvasCreate')
    };

    function createEmptyFrame(w, h) {
        if (h == null) h = w;
        const frame = new Array(h);
        for (let y = 0; y < h; y++) frame[y] = new Array(w).fill(null);
        return frame;
    }

    function canvasSizeFor(ratioId, orientation, densityId) {
        const ratio = RATIOS.find(function (r) { return r.id === ratioId; }) || RATIOS[0];
        const density = DENSITIES.find(function (d) { return d.id === densityId; }) || DENSITIES[2];
        const short = density.short;
        if (ratio.a === ratio.b || orientation === 'square') {
            return { w: short, h: short };
        }
        const longPart = Math.max(ratio.a, ratio.b);
        const shortPart = Math.min(ratio.a, ratio.b);
        let long;
        let shortSide;
        if (ratio.id === '16:9') {
            long = short;
            shortSide = Math.max(1, Math.round(short * shortPart / longPart));
        } else {
            shortSide = short;
            long = Math.round(short * longPart / shortPart);
        }
        long = Math.min(MAX_GRID_SIDE, Math.max(shortSide + 1, long));
        if (orientation === 'landscape') return { w: long, h: shortSide };
        return { w: shortSide, h: long };
    }

    function sizeLabel(w, h) {
        return (w == null ? gridW : w) + '×' + (h == null ? gridH : h);
    }

    function defaultOrientation(ratioId) {
        if (ratioId === '1:1') return 'square';
        if (ratioId === '16:9') return 'landscape';
        return 'portrait';
    }

    function cloneFrame(frame) {
        return frame.map(function (row) { return row.slice(); });
    }

    function cloneFrames(list) {
        return list.map(cloneFrame);
    }

    function parseColor(color) {
        if (!color) return null;
        if (color[0] === '#') {
            let h = color.slice(1);
            if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
            if (h.length !== 6) return null;
            const n = parseInt(h, 16);
            if (Number.isNaN(n)) return null;
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
        const m = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
        return null;
    }

    function toHex(color) {
        const rgb = typeof color === 'string' ? parseColor(color) : color;
        if (!rgb) return null;
        return '#' + rgb.map(function (v) {
            return Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0');
        }).join('').toUpperCase();
    }

    function isInk(color) {
        const hex = toHex(color);
        return hex === INK || hex === '#000000';
    }

    function paletteColors() {
        const list = [INK];
        colorGroups.forEach(function (group) {
            group.colors.forEach(function (c) { list.push(c); });
        });
        return list;
    }

    function nearestPaletteColor(color) {
        const rgb = parseColor(color);
        if (!rgb) return PAPER;
        let best = PAPER;
        let bestD = Infinity;
        paletteColors().forEach(function (hex) {
            if (isInk(hex)) return;
            const p = parseColor(hex);
            const d = (p[0] - rgb[0]) * (p[0] - rgb[0]) +
                (p[1] - rgb[1]) * (p[1] - rgb[1]) +
                (p[2] - rgb[2]) * (p[2] - rgb[2]);
            if (d < bestD) {
                bestD = d;
                best = hex;
            }
        });
        return best;
    }

    function rememberRecent(hex) {
        hex = toHex(hex);
        if (!hex || isInk(hex)) return;
        recentColors = [hex].concat(recentColors.filter(function (c) { return c !== hex; })).slice(0, 8);
    }

    function showToast(message, type) {
        type = type || 'error';
        document.querySelectorAll('.toast').forEach(function (el) { el.remove(); });
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
        const toast = document.createElement('div');
        toast.className = 'toast ' + (type === 'success' ? 'ok' : type === 'info' ? 'info' : 'err');
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        toastTimer = setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(function () { toast.remove(); }, 300);
            toastTimer = null;
        }, 2600);
    }

    function setLoading(on, text) {
        els.overlay.classList.toggle('is-hidden', !on);
        if (text) els.loadingText.textContent = text;
    }

    function frameHasPixels(frame) {
        frame = frame || frames[currentFrameIndex];
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (frame[y][x]) return true;
            }
        }
        return false;
    }

    function updateEmptyState() {
        if (!els.emptyState) return;
        const empty = currentStep !== 3 && !frameHasPixels();
        els.emptyState.classList.toggle('is-hidden', !empty);
        els.emptyState.textContent = currentStep === 2
            ? 'Color fills the inside'
            : 'Draw a closed ink silhouette';
    }

    function confirmAction(title, message, confirmLabel) {
        return new Promise(function (resolve) {
            const overlay = document.createElement('div');
            overlay.className = 'modal-root';
            const panel = document.createElement('div');
            panel.className = 'modal-panel';
            const heading = document.createElement('h3');
            heading.textContent = title;
            const body = document.createElement('p');
            body.style.cssText = 'margin:0;color:var(--muted);font-size:14px;line-height:1.45;text-align:center';
            body.textContent = message;
            const row = document.createElement('div');
            row.className = 'modal-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn-muted';
            cancel.textContent = 'Cancel';
            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'btn-accent';
            ok.textContent = confirmLabel || 'OK';
            function finish(value) {
                overlay.remove();
                resolve(value);
            }
            cancel.addEventListener('click', function () { finish(false); });
            ok.addEventListener('click', function () { finish(true); });
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) finish(false);
            });
            row.appendChild(cancel);
            row.appendChild(ok);
            panel.appendChild(heading);
            panel.appendChild(body);
            panel.appendChild(row);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
            ok.focus();
        });
    }

    function snapshot() {
        return {
            frames: cloneFrames(frames),
            currentFrameIndex: currentFrameIndex,
            gridW: gridW,
            gridH: gridH,
            isAnimationEnabled: isAnimationEnabled,
            isOnionEnabled: isOnionEnabled
        };
    }

    function saveToHistory(opts) {
        opts = opts || {};
        if (historyIndex < history.length - 1) history = history.slice(0, historyIndex + 1);
        history.push(snapshot());
        if (history.length > MAX_HISTORY) history.shift();
        historyIndex = history.length - 1;
        updateHistoryButtons();
        invalidateInsideMask();
        if (!opts.skipPersist) schedulePersist();
    }

    function applySnapshot(snap) {
        gridW = snap.gridW;
        gridH = snap.gridH;
        frames = cloneFrames(snap.frames);
        currentFrameIndex = Math.min(snap.currentFrameIndex, frames.length - 1);
        if (typeof snap.isAnimationEnabled === 'boolean') {
            isAnimationEnabled = snap.isAnimationEnabled;
        } else {
            isAnimationEnabled = frames.length > 1;
        }
        if (typeof snap.isOnionEnabled === 'boolean') isOnionEnabled = snap.isOnionEnabled;
        invalidateInsideMask();
        updateSizeChip();
        updateAnimationUi();
        renderFilmstrip();
        setCanvasSize();
        redrawCanvas();
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        applySnapshot(history[historyIndex]);
        updateHistoryButtons();
        schedulePersist();
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        applySnapshot(history[historyIndex]);
        updateHistoryButtons();
        schedulePersist();
    }

    function updateHistoryButtons() {
        const undoOff = historyIndex <= 0;
        const redoOff = historyIndex >= history.length - 1;
        els.undo.disabled = undoOff;
        els.redo.disabled = redoOff;
    }

    function serializeProject() {
        return {
            version: PROJECT_VERSION,
            gridSize: gridW === gridH ? gridW : undefined,
            gridWidth: gridW,
            gridHeight: gridH,
            frames: frames,
            currentFrameIndex: currentFrameIndex,
            isAnimationEnabled: isAnimationEnabled,
            customColors: recentColors,
            recentColors: recentColors,
            fps: Number(els.fps.value) || 4,
            currentStep: currentStep
        };
    }

    function schedulePersist() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persistNow, 250);
    }

    function newId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function slugName() {
        const s = String(projectName || 'pixel').trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return (s || 'pixel').slice(0, 32);
    }

    function makeThumb() {
        try {
            if (!frameHasPixels()) return '';
            const src = renderFrameToCanvas(frames[currentFrameIndex], { mode: '1x', transparent: true });
            const out = document.createElement('canvas');
            out.width = 64;
            out.height = 64;
            const tctx = out.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            const scale = Math.min(64 / src.width, 64 / src.height);
            const dw = Math.max(1, Math.round(src.width * scale));
            const dh = Math.max(1, Math.round(src.height * scale));
            tctx.drawImage(src, Math.floor((64 - dw) / 2), Math.floor((64 - dh) / 2), dw, dh);
            return out.toDataURL('image/png');
        } catch (err) {
            return '';
        }
    }

    async function persistNow() {
        if (!currentId) currentId = newId();
        const payload = serializeProject();
        if (!window.PixelStore) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            } catch (err) {
                console.warn('Autosave failed', err);
            }
            return;
        }
        try {
            await PixelStore.save({
                id: currentId,
                name: projectName || 'Untitled',
                thumb: makeThumb(),
                data: PixelStore.packData(payload)
            });
            await PixelStore.setCurrentId(currentId);
            if (els.libraryRoot && !els.libraryRoot.classList.contains('is-hidden')) {
                renderShelf();
            }
        } catch (err) {
            console.warn('Autosave failed', err);
            showToast('Storage full. Delete an old creature from the shelf.', 'error');
        }
    }

    function loadProjectObject(data, opts) {
        opts = opts || {};
        if (!data || !Array.isArray(data.frames) || !data.frames.length) {
            throw new Error('Invalid project');
        }
        const first = data.frames[0];
        const inferredH = Array.isArray(first) ? first.length : 0;
        const inferredW = Array.isArray(first && first[0]) ? first[0].length : inferredH;
        const w = Number(data.gridWidth) || Number(data.gridSize) || inferredW || 18;
        const h = Number(data.gridHeight) || Number(data.gridSize) || inferredH || 18;
        if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > MAX_GRID_SIDE || h > MAX_GRID_SIDE) {
            throw new Error('Unsupported canvas size');
        }
        gridW = w;
        gridH = h;
        frames = data.frames.map(function (frame) {
            const next = createEmptyFrame(gridW, gridH);
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    const hex = toHex(frame[y] && frame[y][x]);
                    next[y][x] = isInk(hex) ? INK : hex;
                }
            }
            return next;
        });
        if (frames.length > MAX_FRAMES) frames = frames.slice(0, MAX_FRAMES);
        isAnimationEnabled = !!(data.isAnimationEnabled || frames.length > 1);
        currentFrameIndex = Math.max(0, Math.min(frames.length - 1, Number(data.currentFrameIndex) || 0));
        const loaded = data.recentColors || data.customColors || [];
        recentColors = loaded.map(toHex).filter(Boolean).filter(function (c) { return !isInk(c); }).slice(0, 8);
        if (recentColors[0]) lastPaintColor = recentColors[0];
        if (data.fps) els.fps.value = String(data.fps);
        updateAnimationUi();
        updateSizeChip();
        renderFilmstrip();
        history = [];
        historyIndex = -1;
        saveToHistory({ skipPersist: opts.skipPersist });
        resetView();
        setCanvasSize();
        const step = Number(data.currentStep) || 1;
        switchToStep(step >= 1 && step <= 3 ? step : 1);
        if (!opts.silent) showToast('Project loaded', 'success');
    }

    function restoreAutosave() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            loadProjectObject(JSON.parse(raw), { silent: true, skipPersist: true });
            return true;
        } catch (err) {
            console.warn('Could not restore autosave', err);
            return false;
        }
    }

    function updateNameUi() {
        const label = projectName || 'Untitled';
        if (els.brandName) els.brandName.textContent = label;
        if (els.projectNameInput && document.activeElement !== els.projectNameInput) {
            els.projectNameInput.value = label;
        }
        if (els.sideNameInput && document.activeElement !== els.sideNameInput) {
            els.sideNameInput.value = label;
        }
    }

    function onNameInput(e) {
        projectName = String(e.target.value || '').slice(0, 24);
        if (els.brandName) els.brandName.textContent = projectName || 'Untitled';
        if (e.target !== els.projectNameInput && els.projectNameInput) {
            els.projectNameInput.value = projectName;
        }
        if (e.target !== els.sideNameInput && els.sideNameInput) {
            els.sideNameInput.value = projectName;
        }
        schedulePersist();
    }

    async function renderShelf() {
        if (!els.shelfGrid || !window.PixelStore) return;
        const items = await PixelStore.list();
        els.shelfGrid.innerHTML = '';
        items.forEach(function (rec) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shelf-card' + (rec.id === currentId ? ' on' : '');
            if (rec.thumb) {
                const img = document.createElement('img');
                img.src = rec.thumb;
                img.alt = '';
                btn.appendChild(img);
            } else {
                const ph = document.createElement('div');
                ph.className = 'ph';
                btn.appendChild(ph);
            }
            const cap = document.createElement('span');
            cap.textContent = rec.name || 'Untitled';
            btn.appendChild(cap);
            btn.addEventListener('click', function () { openRecord(rec.id); });
            els.shelfGrid.appendChild(btn);
        });
        if (els.storageNote) {
            els.storageNote.textContent = PixelStore.mode() === 'idb'
                ? 'Working copies on this device (up to ' + PixelStore.SHELF_MAX + '). Save backup to keep a file you can Open later.'
                : 'Working copies in this browser. Save backup / Open backup for a file copy.';
        }
    }

    async function openLibrary() {
        await persistNow();
        await renderShelf();
        els.libraryRoot.classList.remove('is-hidden');
        if (els.projectNameInput) els.projectNameInput.focus();
    }

    function closeLibrary() {
        els.libraryRoot.classList.add('is-hidden');
    }

    function resetDrawing(w, h) {
        gridW = w || 64;
        gridH = h || 64;
        frames = [createEmptyFrame(gridW, gridH)];
        currentFrameIndex = 0;
        isAnimationEnabled = false;
        recentColors = [];
        lastPaintColor = DEFAULT_PAINT;
        lastStrokeCell = null;
        invalidateInsideMask();
        isOnionEnabled = false;
        currentTool = 'draw';
        currentColor = INK;
        showGrid = true;
        els.grid.classList.add('on');
        history = [];
        historyIndex = -1;
        lastTap = null;
        if (previewInterval) {
            clearInterval(previewInterval);
            previewInterval = null;
        }
        updateSizeChip();
        updateAnimationUi();
        saveToHistory({ skipPersist: true });
        switchToStep(1);
        resetView();
    }

    async function nextUntitledName() {
        if (!window.PixelStore) return 'Untitled';
        const items = await PixelStore.list();
        const used = {};
        items.forEach(function (p) { used[String(p.name || '').toLowerCase()] = true; });
        if (!used.untitled) return 'Untitled';
        let n = 2;
        while (used['untitled ' + n]) n++;
        return 'Untitled ' + n;
    }

    function renderNewCanvasUi() {
        const pick = newCanvasPick;
        const size = canvasSizeFor(pick.ratio, pick.orientation, pick.density);
        if (els.newCanvasLabel) els.newCanvasLabel.textContent = sizeLabel(size.w, size.h);
        if (els.newCanvasShape) {
            const k = Math.min(180 / size.w, 96 / size.h);
            els.newCanvasShape.style.width = Math.max(28, Math.round(size.w * k)) + 'px';
            els.newCanvasShape.style.height = Math.max(28, Math.round(size.h * k)) + 'px';
        }
        if (els.ratioRow) {
            els.ratioRow.innerHTML = '';
            RATIOS.forEach(function (ratio) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = ratio.id;
                if (pick.ratio === ratio.id) btn.classList.add('on');
                btn.addEventListener('click', function () {
                    newCanvasPick.ratio = ratio.id;
                    newCanvasPick.orientation = defaultOrientation(ratio.id);
                    renderNewCanvasUi();
                });
                els.ratioRow.appendChild(btn);
            });
        }
        if (els.orientRow) {
            els.orientRow.innerHTML = '';
            [
                { id: 'square', label: 'Square' },
                { id: 'portrait', label: 'Portrait' },
                { id: 'landscape', label: 'Landscape' }
            ].forEach(function (orient) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = orient.label;
                const squareRatio = pick.ratio === '1:1';
                btn.disabled = squareRatio ? orient.id !== 'square' : orient.id === 'square';
                if (pick.orientation === orient.id) btn.classList.add('on');
                btn.addEventListener('click', function () {
                    if (btn.disabled) return;
                    newCanvasPick.orientation = orient.id;
                    renderNewCanvasUi();
                });
                els.orientRow.appendChild(btn);
            });
        }
        if (els.densityRow) {
            els.densityRow.innerHTML = '';
            const phone = isMobileChrome();
            if (phone && Number(pick.density) >= 128) newCanvasPick.density = '64';
            DENSITIES.forEach(function (density) {
                const dim = canvasSizeFor(pick.ratio, pick.orientation, density.id);
                const btn = document.createElement('button');
                btn.type = 'button';
                const tooDense = phone && Number(density.id) >= 128;
                btn.disabled = tooDense;
                if (tooDense) btn.title = 'Too dense for this screen';
                if (newCanvasPick.density === density.id) btn.classList.add('on');
                btn.textContent = sizeLabel(dim.w, dim.h);
                btn.addEventListener('click', function () {
                    if (btn.disabled) return;
                    newCanvasPick.density = density.id;
                    renderNewCanvasUi();
                });
                els.densityRow.appendChild(btn);
            });
            let note = document.getElementById('densityNote');
            if (!note) {
                note = document.createElement('p');
                note.id = 'densityNote';
                note.className = 'storage-note';
                els.densityRow.parentNode.appendChild(note);
            }
            note.textContent = phone ? '128 and 256 are easier on a larger screen.' : '';
            note.classList.toggle('is-hidden', !phone);
        }
    }

    function openNewCanvasDialog(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            newCanvasResolver = resolve;
            newCanvasAllowCancel = opts.allowCancel !== false;
            newCanvasPick = { ratio: '1:1', orientation: 'square', density: '64' };
            if (els.newCanvasCancel) {
                els.newCanvasCancel.classList.toggle('is-hidden', !newCanvasAllowCancel);
            }
            renderNewCanvasUi();
            if (els.newCanvasRoot) els.newCanvasRoot.classList.remove('is-hidden');
            applyView();
            if (els.newCanvasCreate) els.newCanvasCreate.focus();
        });
    }

    function closeNewCanvasDialog(result) {
        if (els.newCanvasRoot) els.newCanvasRoot.classList.add('is-hidden');
        applyView();
        const resolve = newCanvasResolver;
        newCanvasResolver = null;
        if (resolve) resolve(result || null);
    }

    async function startNewProject() {
        await persistNow();
        const size = await openNewCanvasDialog({ allowCancel: true });
        if (!size) return;
        currentId = newId();
        projectName = await nextUntitledName();
        resetDrawing(size.w, size.h);
        updateNameUi();
        await persistNow();
        renderShelf();
        closeLibrary();
    }

    async function openRecord(id) {
        if (!id || id === currentId) {
            closeLibrary();
            return;
        }
        await persistNow();
        const rec = await PixelStore.load(id);
        if (!rec || !rec.data) return;
        currentId = rec.id;
        projectName = rec.name || 'Untitled';
        loadProjectObject(PixelStore.unpackData(rec.data), { silent: true, skipPersist: true });
        await PixelStore.setCurrentId(currentId);
        updateNameUi();
        renderShelf();
        closeLibrary();
    }

    async function deleteCurrent() {
        const ok = await confirmAction(
            'Delete ' + (projectName || 'this creature') + '?',
            'This cannot be undone.',
            'Delete'
        );
        if (!ok) return;
        const id = currentId;
        if (window.PixelStore) await PixelStore.remove(id);
        const items = window.PixelStore ? await PixelStore.list() : [];
        if (items.length) {
            const rec = items[0];
            currentId = rec.id;
            projectName = rec.name || 'Untitled';
            loadProjectObject(PixelStore.unpackData(rec.data), { silent: true, skipPersist: true });
            await PixelStore.setCurrentId(currentId);
            updateNameUi();
            renderShelf();
            closeLibrary();
        } else {
            const size = await openNewCanvasDialog({ allowCancel: false });
            currentId = newId();
            projectName = 'Untitled';
            resetDrawing(size.w, size.h);
            updateNameUi();
            await persistNow();
            renderShelf();
            closeLibrary();
        }
    }

    function stickerLayout() {
        const scale = Math.max(1, Math.floor(Math.min(STICKER_SIZE / gridW, STICKER_SIZE / gridH)));
        const drawW = scale * gridW;
        const drawH = scale * gridH;
        return {
            scale: scale,
            padX: Math.floor((STICKER_SIZE - drawW) / 2),
            padY: Math.floor((STICKER_SIZE - drawH) / 2),
            size: STICKER_SIZE
        };
    }

    function renderFrameToCanvas(frame, options) {
        options = options || {};
        const mode = options.mode || 'display';
        const transparent = options.transparent !== false;
        const background = options.background || THEME.paper;
        const out = document.createElement('canvas');
        const octx = out.getContext('2d');
        octx.imageSmoothingEnabled = false;

        let scale;
        let padX = 0;
        let padY = 0;
        let outW;
        let outH;
        if (mode === '1x') {
            scale = 1;
            outW = gridW;
            outH = gridH;
        } else if (mode === 'sticker') {
            const layout = stickerLayout();
            scale = layout.scale;
            padX = layout.padX;
            padY = layout.padY;
            outW = layout.size;
            outH = layout.size;
        } else {
            scale = pixelSize;
            outW = Math.round(pixelSize * gridW);
            outH = Math.round(pixelSize * gridH);
        }

        out.width = outW;
        out.height = outH;
        if (!transparent) {
            octx.fillStyle = background;
            octx.fillRect(0, 0, outW, outH);
        } else {
            octx.clearRect(0, 0, outW, outH);
        }

        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const color = frame[y] && frame[y][x];
                if (!color) continue;
                octx.fillStyle = color;
                octx.fillRect(padX + x * scale, padY + y * scale, scale, scale);
            }
        }
        return out;
    }

    function canvasToRgba(c) {
        return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    function canvasToBlob(c, type, quality) {
        return new Promise(function (resolve, reject) {
            c.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error('Export failed'));
            }, type, quality);
        });
    }

    function fileBase() {
        return slugName() + '-' + gridW + 'x' + gridH;
    }

    function drawCheckerboard(context, width, height, cell) {
        cell = cell || Math.max(4, pixelSize / 2);
        for (let y = 0; y < height; y += cell) {
            for (let x = 0; x < width; x += cell) {
                context.fillStyle = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0) ? THEME.checkA : THEME.checkB;
                context.fillRect(x, y, cell, cell);
            }
        }
    }

    function drawOverlayGrid() {
        const overlay = els.gridOverlay;
        const stage = els.canvasStage;
        if (!overlay || !stage) return;
        const sw = Math.max(1, stage.clientWidth);
        const sh = Math.max(1, stage.clientHeight);
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        if (overlay.width !== Math.round(sw * dpr) || overlay.height !== Math.round(sh * dpr)) {
            overlay.width = Math.round(sw * dpr);
            overlay.height = Math.round(sh * dpr);
            overlay.style.width = sw + 'px';
            overlay.style.height = sh + 'px';
        }
        const octx = overlay.getContext('2d');
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.clearRect(0, 0, sw, sh);
        if (!showGrid || currentStep === 3) return;

        const canvasRect = canvas.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const originX = canvasRect.left - stageRect.left;
        const originY = canvasRect.top - stageRect.top;
        const cellW = canvasRect.width / gridW;
        const cellH = canvasRect.height / gridH;
        if (cellW < 4 || cellH < 4) return;

        octx.save();
        octx.beginPath();
        octx.rect(originX, originY, canvasRect.width, canvasRect.height);
        octx.clip();
        octx.strokeStyle = currentStep === 1 ? THEME.gridPaper : THEME.gridCheck;
        octx.lineWidth = 1;
        octx.beginPath();
        for (let x = 0; x <= gridW; x++) {
            const px = Math.round(originX + x * cellW) + 0.5;
            octx.moveTo(px, originY);
            octx.lineTo(px, originY + canvasRect.height);
        }
        for (let y = 0; y <= gridH; y++) {
            const py = Math.round(originY + y * cellH) + 0.5;
            octx.moveTo(originX, py);
            octx.lineTo(originX + canvasRect.width, py);
        }
        octx.stroke();
        octx.restore();
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentStep === 1) {
            ctx.fillStyle = THEME.paper;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            drawCheckerboard(ctx, canvas.width, canvas.height);
        }

        if (isOnionEnabled && isAnimationEnabled && currentFrameIndex > 0) {
            const prev = frames[currentFrameIndex - 1];
            ctx.globalAlpha = 0.25;
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    const color = prev[y][x];
                    if (!color) continue;
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
            ctx.globalAlpha = 1;
        }

        const pixelMap = frames[currentFrameIndex];
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const color = pixelMap[y][x];
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
        updateEmptyState();
        drawOverlayGrid();
    }

    function setCanvasSize() {
        const rect = els.bezel.getBoundingClientRect();
        const pad = 20;
        const availW = Math.max(1, Math.floor(rect.width - pad));
        const availH = Math.max(1, Math.floor(rect.height - pad));
        pixelSize = Math.max(1, Math.floor(Math.min(availW / gridW, availH / gridH)) || 1);
        const canvasW = pixelSize * gridW;
        const canvasH = pixelSize * gridH;
        canvas.width = canvasW;
        canvas.height = canvasH;
        ctx.imageSmoothingEnabled = false;
        const cssScale = Math.min(1, availW / canvasW, availH / canvasH);
        canvas.style.width = Math.max(1, Math.round(canvasW * cssScale)) + 'px';
        canvas.style.height = Math.max(1, Math.round(canvasH * cssScale)) + 'px';
        redrawCanvas();
        applyView();
    }

    function displayCellSize() {
        return (canvas.offsetWidth || canvas.width) / Math.max(1, gridW);
    }

    function maxViewScale() {
        return Math.max(8, Math.min(24, Math.ceil(24 / Math.max(0.5, displayCellSize()))));
    }

    function viewIsIdle() {
        return viewScale <= 1.02 && Math.abs(viewX) < 2 && Math.abs(viewY) < 2;
    }

    function applyView() {
        canvas.style.transform = 'translate(' + viewX + 'px, ' + viewY + 'px) scale(' + viewScale + ')';
        if (els.zoomReset) {
            const idle = viewIsIdle();
            const visualCell = displayCellSize() * viewScale;
            const dialogOpen = els.newCanvasRoot && !els.newCanvasRoot.classList.contains('is-hidden');
            const coach = currentStep !== 3 && !dialogOpen && visualCell < 8 && idle;
            if (currentStep === 3 || dialogOpen) {
                els.zoomReset.classList.add('is-hidden');
                els.zoomReset.classList.remove('is-coach');
            } else if (coach) {
                els.zoomReset.classList.remove('is-hidden');
                els.zoomReset.classList.add('is-coach');
                els.zoomReset.textContent = 'Pinch to zoom';
            } else {
                els.zoomReset.classList.toggle('is-hidden', idle);
                els.zoomReset.classList.remove('is-coach');
                els.zoomReset.textContent = Math.round(viewScale * 10) / 10 + '×';
            }
        }
        drawOverlayGrid();
    }

    function resetView() {
        viewScale = 1;
        viewX = 0;
        viewY = 0;
        pinch = null;
        panning = false;
        applyView();
    }

    function clampView() {
        viewScale = Math.min(maxViewScale(), Math.max(1, viewScale));
        if (viewScale <= 1) {
            viewScale = 1;
            viewX = 0;
            viewY = 0;
            return;
        }
        const baseW = canvas.offsetWidth || canvas.width;
        const baseH = canvas.offsetHeight || canvas.height;
        const maxX = (viewScale - 1) * baseW / 2 + 48;
        const maxY = (viewScale - 1) * baseH / 2 + 48;
        viewX = Math.max(-maxX, Math.min(maxX, viewX));
        viewY = Math.max(-maxY, Math.min(maxY, viewY));
    }

    function zoomToward(clientX, clientY, nextScale) {
        const stage = els.canvasStage || canvas;
        const rect = stage.getBoundingClientRect();
        const old = viewScale;
        viewScale = nextScale;
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        const k = viewScale / (old || 1);
        viewX = cx - (cx - viewX) * k;
        viewY = cy - (cy - viewY) * k;
        clampView();
        applyView();
    }

    function toggleZoomAt(clientX, clientY) {
        if (viewScale > 1.4) {
            resetView();
            return;
        }
        zoomToward(clientX, clientY, Math.min(maxViewScale(), Math.max(4, 16 / Math.max(0.5, displayCellSize()))));
    }

    function touchDist(a, b) {
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function touchMid(a, b) {
        return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    }

    function fillPixel(gridX, gridY, opts) {
        opts = opts || {};
        if (gridX < 0 || gridX >= gridW || gridY < 0 || gridY >= gridH) return;
        if (currentStep === 3) return;
        const pixelMap = frames[currentFrameIndex];
        const existing = pixelMap[gridY][gridX];
        if (currentStep === 2 && isInk(existing)) return;

        let fillColor;
        if (currentStep === 1) {
            fillColor = currentTool === 'draw' ? INK : null;
        } else if (currentStep === 2) {
            if (isInk(currentColor)) return;
            if (currentTool === 'draw' && !isInsideClosed(gridX, gridY)) {
                maybeOutsideHint();
                return;
            }
            fillColor = currentTool === 'draw' ? currentColor : null;
        } else {
            return;
        }
        if (existing === fillColor) return;
        pixelMap[gridY][gridX] = fillColor;
        strokeDirty = true;
        if (!opts.skipRedraw) {
            redrawCanvas();
            if (currentStep === 1 && fillColor === INK) maybeInkHint();
        }
    }

    function paintLine(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
            fillPixel(x0, y0, { skipRedraw: true });
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        redrawCanvas();
        if (currentStep === 1 && strokeDirty) maybeInkHint();
    }

    function maybeInkHint() {
        try {
            if (localStorage.getItem('pixel-ink-hint')) return;
            localStorage.setItem('pixel-ink-hint', '1');
        } catch (err) {
            if (maybeInkHint.shown) return;
            maybeInkHint.shown = true;
        }
        showToast('Color fills the inside. Ink stays locked.', 'info');
    }

    function invalidateInsideMask() {
        insideMask = null;
    }

    function ensureInsideMask() {
        if (insideMask && insideMask.length === gridH && insideMask[0] && insideMask[0].length === gridW) {
            return insideMask;
        }
        const pixelMap = frames[currentFrameIndex];
        const mask = new Array(gridH);
        for (let y = 0; y < gridH; y++) {
            mask[y] = new Array(gridW).fill(true);
        }
        const qx = [];
        const qy = [];
        function enqueue(x, y) {
            if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
            if (!mask[y][x]) return;
            if (isInk(pixelMap[y] && pixelMap[y][x])) return;
            mask[y][x] = false;
            qx.push(x);
            qy.push(y);
        }
        for (let x = 0; x < gridW; x++) {
            enqueue(x, 0);
            enqueue(x, gridH - 1);
        }
        for (let y = 1; y < gridH - 1; y++) {
            enqueue(0, y);
            enqueue(gridW - 1, y);
        }
        let qh = 0;
        while (qh < qx.length) {
            const x = qx[qh];
            const y = qy[qh];
            qh++;
            enqueue(x + 1, y);
            enqueue(x - 1, y);
            enqueue(x, y + 1);
            enqueue(x, y - 1);
        }
        insideMask = mask;
        return mask;
    }

    function isInsideClosed(x, y) {
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
        const pixelMap = frames[currentFrameIndex];
        if (isInk(pixelMap[y] && pixelMap[y][x])) return false;
        return !!ensureInsideMask()[y][x];
    }

    function maybeOutsideHint() {
        try {
            if (localStorage.getItem('pixel-outside-hint')) return;
            localStorage.setItem('pixel-outside-hint', '1');
        } catch (err) {
            if (maybeOutsideHint.shown) return;
            maybeOutsideHint.shown = true;
        }
        showToast('Color only paints inside a closed outline', 'info');
    }

    function floodFill(startX, startY) {
        if (currentStep !== 2) return;
        if (startX < 0 || startY < 0 || startX >= gridW || startY >= gridH) return;
        const pixelMap = frames[currentFrameIndex];
        const targetColor = pixelMap[startY][startX];
        if (isInk(targetColor) || isInk(currentColor) || targetColor === currentColor) return;

        const visited = createEmptyFrame(gridW, gridH);
        const queue = [{ x: startX, y: startY }];
        const region = [];
        let open = false;

        while (queue.length) {
            const cell = queue.shift();
            const x = cell.x;
            const y = cell.y;
            if (x < 0 || x >= gridW || y < 0 || y >= gridH) continue;
            if (visited[y][x]) continue;
            if (isInk(pixelMap[y][x])) continue;
            if (pixelMap[y][x] !== targetColor) continue;
            if (x === 0 || y === 0 || x === gridW - 1 || y === gridH - 1) {
                open = true;
                break;
            }
            visited[y][x] = true;
            region.push(cell);
            queue.push({ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 });
        }
        if (open || !region.length) {
            showToast(open
                ? 'Fill only works inside a closed outline'
                : 'Nothing to fill here', 'info');
            return;
        }
        for (let i = 0; i < region.length; i++) {
            pixelMap[region[i].y][region[i].x] = currentColor;
        }
        redrawCanvas();
        saveToHistory();
    }

    function eventToGrid(e) {
        const point = e.touches ? e.touches[0] : e;
        const rect = canvas.getBoundingClientRect();
        const x = (point.clientX - rect.left) * (canvas.width / rect.width);
        const y = (point.clientY - rect.top) * (canvas.height / rect.height);
        return { x: Math.floor(x / pixelSize), y: Math.floor(y / pixelSize) };
    }

    function pickColorAt(gx, gy) {
        if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return;
        const c = frames[currentFrameIndex][gy][gx];
        if (!c || isInk(c)) return;
        const hex = toHex(c);
        if (hex) lastPaintColor = hex;
        setCurrentColor(c);
        rememberRecent(c);
        createColorPalette();
        schedulePersist();
    }

    function clearPressTimer() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }

    function isDoubleTap(pt) {
        if (!lastTap || !pt) return false;
        if (Date.now() - lastTap.t > 320) return false;
        return Math.hypot(pt.clientX - lastTap.x, pt.clientY - lastTap.y) < 28;
    }

    function handlePointerDown(e) {
        if (pinch) return;
        const pt = e.touches ? e.touches[0] : e;
        if (e.button === 1 || spaceDown) {
            panning = true;
            panStart = { x: pt.clientX, y: pt.clientY, vx: viewX, vy: viewY };
            return;
        }
        if (isDoubleTap(pt)) {
            toggleZoomAt(pt.clientX, pt.clientY);
            lastTap = null;
            pendingTap = null;
            isDrawing = false;
            strokeDirty = false;
            lastStrokeCell = null;
            return;
        }
        if (e.button === 2) return;
        if (previewInterval) stopPreview();
        const cell = eventToGrid(e);
        const map = frames[currentFrameIndex];
        const prev = map[cell.y] ? map[cell.y][cell.x] : null;
        pendingTap = { x: pt.clientX, y: pt.clientY, gx: cell.x, gy: cell.y, prev: prev, moved: false };
        if (currentStep === 3) return;
        if (e.altKey || currentTool === 'eyedrop') {
            pendingTap = null;
            pickColorAt(cell.x, cell.y);
            if (currentTool === 'eyedrop') setActiveTool('draw');
            return;
        }
        if (currentStep === 2 && currentTool === 'fill') {
            pendingTap = null;
            floodFill(cell.x, cell.y);
            return;
        }
        isDrawing = true;
        strokeDirty = false;
        longPressFired = false;
        lastStrokeCell = { x: cell.x, y: cell.y };
        fillPixel(cell.x, cell.y);
        if (e.touches && currentStep === 2) {
            pressCell = { x: cell.x, y: cell.y, prev: prev };
            clearPressTimer();
            pressTimer = setTimeout(function () {
                longPressFired = true;
                isDrawing = false;
                strokeDirty = false;
                if (pressCell && frames[currentFrameIndex][pressCell.y]) {
                    frames[currentFrameIndex][pressCell.y][pressCell.x] = pressCell.prev;
                }
                redrawCanvas();
                if (pressCell) pickColorAt(pressCell.x, pressCell.y);
                pressTimer = null;
            }, 450);
        }
    }

    function handlePointerMove(e) {
        if (panning && panStart) {
            const pt = e.touches ? e.touches[0] : e;
            viewX = panStart.vx + (pt.clientX - panStart.x);
            viewY = panStart.vy + (pt.clientY - panStart.y);
            clampView();
            applyView();
            return;
        }
        const cell = eventToGrid(e);
        if (pressTimer && pressCell && (cell.x !== pressCell.x || cell.y !== pressCell.y)) {
            clearPressTimer();
        }
        if (pendingTap && (cell.x !== pendingTap.gx || cell.y !== pendingTap.gy)) {
            pendingTap.moved = true;
        }
        if (!isDrawing || longPressFired) return;
        if (lastStrokeCell && (cell.x !== lastStrokeCell.x || cell.y !== lastStrokeCell.y)) {
            paintLine(lastStrokeCell.x, lastStrokeCell.y, cell.x, cell.y);
        } else {
            fillPixel(cell.x, cell.y);
        }
        lastStrokeCell = { x: cell.x, y: cell.y };
    }

    function handlePointerUp() {
        panning = false;
        panStart = null;
        clearPressTimer();
        if (longPressFired) {
            longPressFired = false;
            isDrawing = false;
            strokeDirty = false;
            lastStrokeCell = null;
            pendingTap = null;
            lastTap = null;
            return;
        }
        const saved = isDrawing && strokeDirty;
        if (saved) saveToHistory();
        if (pendingTap && !pendingTap.moved) {
            lastTap = {
                t: Date.now(),
                x: pendingTap.x,
                y: pendingTap.y,
                restore: { x: pendingTap.gx, y: pendingTap.gy, prev: pendingTap.prev },
                saved: saved
            };
        } else {
            lastTap = null;
        }
        pendingTap = null;
        isDrawing = false;
        strokeDirty = false;
        lastStrokeCell = null;
    }

    function imageToGrid(img) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const tmp = document.createElement('canvas');
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tmp.width = gridW;
        tmp.height = gridH;

        if (w === gridW && h === gridH) {
            const src = document.createElement('canvas');
            src.width = w;
            src.height = h;
            const sctx = src.getContext('2d');
            sctx.drawImage(img, 0, 0);
            const data = sctx.getImageData(0, 0, w, h).data;
            const grid = createEmptyFrame(gridW, gridH);
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    const i = (y * w + x) * 4;
                    grid[y][x] = samplePixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
                }
            }
            return grid;
        }

        if (w % gridW === 0 && h % gridH === 0 && w / gridW === h / gridH) {
            const scale = w / gridW;
            const src = document.createElement('canvas');
            src.width = w;
            src.height = h;
            const sctx = src.getContext('2d');
            sctx.drawImage(img, 0, 0);
            const data = sctx.getImageData(0, 0, w, h).data;
            const grid = createEmptyFrame(gridW, gridH);
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    const cx = Math.floor(x * scale + scale / 2);
                    const cy = Math.floor(y * scale + scale / 2);
                    const i = (cy * w + cx) * 4;
                    grid[y][x] = samplePixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
                }
            }
            return grid;
        }

        tctx.clearRect(0, 0, gridW, gridH);
        tctx.drawImage(img, 0, 0, gridW, gridH);
        const data = tctx.getImageData(0, 0, gridW, gridH).data;
        const grid = createEmptyFrame(gridW, gridH);
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const i = (y * gridW + x) * 4;
                grid[y][x] = samplePixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
            }
        }
        return grid;
    }

    function samplePixel(r, g, b, a) {
        if (a < 128) return null;
        if (r < 40 && g < 36 && b < 32) return INK;
        return toHex([r, g, b]);
    }

    function uploadImage() {
        closeMore();
        els.fileInput.value = '';
        els.fileInput.click();
    }

    function applyUploadedImage(img) {
        const grid = imageToGrid(img);
        if (currentStep === 2) {
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    if (isInk(frames[currentFrameIndex][y][x])) grid[y][x] = INK;
                }
            }
        }
        frames[currentFrameIndex] = grid;
        saveToHistory();
        redrawCanvas();
        renderFilmstrip();
        showToast('Image mapped to ' + sizeLabel(), 'success');
    }

    function onImageChosen(file) {
        if (!file) return;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function () {
            URL.revokeObjectURL(url);
            const run = function () {
                try {
                    applyUploadedImage(img);
                } catch (err) {
                    console.error(err);
                    showToast('Failed to load image');
                }
            };
            if (!frameHasPixels()) {
                run();
                return;
            }
            confirmAction(
                'Replace this frame?',
                'The current drawing will be overwritten. Undo can restore it.',
                'Replace'
            ).then(function (ok) {
                if (ok) run();
            });
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            showToast('Failed to load image');
        };
        img.src = url;
    }

    function copyPreviousFrame() {
        if (!isAnimationEnabled || currentFrameIndex === 0) return;
        frames[currentFrameIndex] = cloneFrame(frames[currentFrameIndex - 1]);
        redrawCanvas();
        saveToHistory();
        renderFilmstrip();
        showToast('Copied previous frame', 'success');
    }

    function setActiveTool(tool) {
        if ((tool === 'fill' || tool === 'eyedrop') && currentStep !== 2) return;
        currentTool = tool;
        document.querySelectorAll('[data-tool]').forEach(function (btn) {
            btn.classList.toggle('on', btn.getAttribute('data-tool') === tool);
        });
        canvas.style.cursor = tool === 'eyedrop' ? 'copy' : (currentStep === 3 ? 'default' : 'crosshair');
    }

    function selectPaintColor(color) {
        const hex = toHex(color);
        if (!hex || isInk(hex)) return;
        lastPaintColor = hex;
        setCurrentColor(hex);
        rememberRecent(hex);
        createColorPalette();
        schedulePersist();
    }

    function createColorPalette() {
        const root = els.palette;
        root.innerHTML = '';

        for (let i = 0; i < colorGroups.length; i++) {
            if (colorGroups[i].colors.indexOf(currentColor) !== -1) {
                activeHue = i;
                break;
            }
        }

        const inkRow = document.createElement('div');
        inkRow.className = 'ink-row';
        const inkBtn = document.createElement('button');
        inkBtn.type = 'button';
        inkBtn.className = 'ink-swatch';
        inkBtn.title = 'Edit outline';
        inkBtn.addEventListener('click', function () { switchToStep(1); });
        const inkLabel = document.createElement('span');
        inkLabel.textContent = 'Ink · tap to edit outline';
        inkRow.appendChild(inkBtn);
        inkRow.appendChild(inkLabel);

        const hues = document.createElement('div');
        hues.className = 'hues';
        colorGroups.forEach(function (group, index) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dot' + (index === activeHue ? ' on' : '');
            btn.style.background = group.colors[1];
            btn.setAttribute('aria-label', group.name);
            btn.title = group.name;
            btn.addEventListener('click', function () {
                activeHue = index;
                selectPaintColor(group.colors[1]);
            });
            hues.appendChild(btn);
        });

        const shades = document.createElement('div');
        shades.className = 'shades';
        colorGroups[activeHue].colors.forEach(function (color) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shade' + (color === currentColor ? ' on' : '');
            btn.style.background = color;
            btn.title = colorGroups[activeHue].name;
            btn.addEventListener('click', function () { selectPaintColor(color); });
            shades.appendChild(btn);
        });

        const all = document.createElement('div');
        all.className = 'all-shades';
        colorGroups.forEach(function (group) {
            group.colors.forEach(function (color) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.background = color;
                btn.title = group.name;
                if (color === currentColor) btn.classList.add('on');
                btn.addEventListener('click', function () { selectPaintColor(color); });
                all.appendChild(btn);
            });
        });

        root.appendChild(inkRow);
        root.appendChild(hues);
        root.appendChild(shades);
        root.appendChild(all);

        els.customColors.innerHTML = '';
        recentColors.forEach(function (color) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dot' + (color === currentColor ? ' on' : '');
            btn.style.background = color;
            btn.addEventListener('click', function () { selectPaintColor(color); });
            els.customColors.appendChild(btn);
        });
    }

    function setCurrentColor(color) {
        const hex = toHex(color) || color;
        currentColor = hex;
        els.currentColor.style.backgroundColor = hex;
        if (els.colorFab) els.colorFab.style.backgroundColor = hex;
        if (hex[0] === '#') els.colorPicker.value = hex.toLowerCase();
    }

    function snapFromPicker(raw) {
        const hex = toHex(raw);
        if (!hex || isInk(hex)) return;
        selectPaintColor(hex);
    }

    function renderFilmstrip() {
        const strip = els.filmstrip;
        strip.innerHTML = '';
        if (!isAnimationEnabled) return;
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'frame-thumb play';
        play.title = previewInterval ? 'Stop preview' : 'Play';
        play.textContent = previewInterval ? '■' : '▶';
        play.addEventListener('click', previewAnimation);
        strip.appendChild(play);
        frames.forEach(function (frame, index) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'frame-thumb' + (index === currentFrameIndex ? ' on' : '');
            btn.title = 'Frame ' + (index + 1);
            const thumb = renderFrameToCanvas(frame, { mode: '1x', transparent: true });
            btn.appendChild(thumb);
            const num = document.createElement('span');
            num.className = 'frame-num';
            num.textContent = String(index + 1);
            btn.appendChild(num);
            btn.addEventListener('click', function () { goToFrame(index); });
            if (index === currentFrameIndex && frames.length > 1) {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'frame-del';
                del.title = 'Delete frame';
                del.textContent = '×';
                del.addEventListener('click', function (e) {
                    e.stopPropagation();
                    deleteCurrentFrame();
                });
                btn.appendChild(del);
            }
            strip.appendChild(btn);
        });
        if (frames.length < MAX_FRAMES) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'frame-thumb';
            add.textContent = '+';
            add.title = 'Add frame';
            add.addEventListener('click', function () { updateFrameCount(frames.length + 1, { copy: true }); });
            strip.appendChild(add);
        }
        const actions = document.createElement('div');
        actions.className = 'film-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'ghost';
        copy.textContent = 'Copy prev';
        copy.disabled = currentFrameIndex === 0;
        copy.addEventListener('click', copyPreviousFrame);
        const onion = document.createElement('button');
        onion.type = 'button';
        onion.className = 'ghost' + (isOnionEnabled ? ' on' : '');
        onion.textContent = 'Onion';
        onion.addEventListener('click', toggleOnion);
        const delFrame = document.createElement('button');
        delFrame.type = 'button';
        delFrame.className = 'ghost';
        delFrame.textContent = 'Delete';
        delFrame.disabled = frames.length <= 1;
        delFrame.addEventListener('click', deleteCurrentFrame);
        actions.appendChild(copy);
        actions.appendChild(onion);
        actions.appendChild(delFrame);
        strip.appendChild(actions);
    }

    function deleteCurrentFrame() {
        if (!isAnimationEnabled || frames.length <= 1) return;
        frames.splice(currentFrameIndex, 1);
        if (currentFrameIndex >= frames.length) currentFrameIndex = frames.length - 1;
        renderFilmstrip();
        updateExportVisibility();
        redrawCanvas();
        saveToHistory();
    }

    function goToFrame(index) {
        currentFrameIndex = Math.max(0, Math.min(frames.length - 1, index));
        invalidateInsideMask();
        renderFilmstrip();
        redrawCanvas();
        schedulePersist();
    }

    function updateFrameCount(newCount, opts) {
        opts = opts || {};
        newCount = Math.max(1, Math.min(MAX_FRAMES, newCount | 0));
        const oldCount = frames.length;
        if (newCount < oldCount) {
            frames = frames.slice(0, newCount);
            if (currentFrameIndex >= newCount) currentFrameIndex = newCount - 1;
        } else if (newCount > oldCount) {
            const source = frames[currentFrameIndex];
            for (let i = oldCount; i < newCount; i++) {
                frames.push(opts.copy && source ? cloneFrame(source) : createEmptyFrame(gridW, gridH));
            }
            if (!opts.stay) currentFrameIndex = newCount - 1;
        }
        renderFilmstrip();
        updateExportVisibility();
        redrawCanvas();
        saveToHistory();
    }

    function updateSizeChip() {
        const label = sizeLabel();
        if (els.sizeChip) els.sizeChip.textContent = label;
        if (els.pngHint) els.pngHint.textContent = label + ' true pixels';
        const sheetSize = document.getElementById('sheetSize');
        if (sheetSize) sheetSize.textContent = 'Canvas ' + label;
    }

    function updateAnimationUi() {
        els.app.setAttribute('data-anim', isAnimationEnabled ? 'on' : 'off');
        els.animToggle.classList.toggle('on', isAnimationEnabled);
        els.animToggle.setAttribute('aria-pressed', isAnimationEnabled ? 'true' : 'false');
        els.copyPrev.classList.toggle('is-hidden', !isAnimationEnabled);
        els.copyPrev.disabled = currentFrameIndex === 0;
        els.onion.classList.toggle('is-hidden', !isAnimationEnabled);
        renderFilmstrip();
        updateExportVisibility();
    }

    function updateExportVisibility() {
        const multi = isAnimationEnabled && frames.length > 1;
        els.gifCard.classList.toggle('is-disabled', !multi);
        els.exportGif.disabled = !multi;
        if (els.gifHint) {
            els.gifHint.textContent = multi ? 'Publish a looping sticker' : 'Turn on Anim to make a GIF';
        }
        els.gifExtras.classList.toggle('is-hidden', !multi);
        els.saveAll.classList.toggle('is-hidden', !multi);
        els.preview.textContent = previewInterval ? 'Stop' : 'Preview';
        const play = els.filmstrip.querySelector('.frame-thumb.play');
        if (play) {
            play.textContent = previewInterval ? '■' : '▶';
            play.title = previewInterval ? 'Stop preview' : 'Play';
        }
    }

    async function toggleAnimation() {
        if (isAnimationEnabled && frames.length > 1) {
            const ok = await confirmAction(
                'Turn off animation?',
                'Extra frames will be removed. Undo can restore them.',
                'Turn off'
            );
            if (!ok) return;
        }
        stopPreview();
        isAnimationEnabled = !isAnimationEnabled;
        if (isAnimationEnabled) {
            if (frames.length === 1) updateFrameCount(2, { copy: true, stay: true });
        } else {
            frames = [frames[currentFrameIndex]];
            currentFrameIndex = 0;
            isOnionEnabled = false;
            saveToHistory();
        }
        updateAnimationUi();
        setCanvasSize();
        schedulePersist();
    }

    function toggleOnion() {
        isOnionEnabled = !isOnionEnabled;
        els.onion.classList.toggle('on', isOnionEnabled);
        redrawCanvas();
        renderFilmstrip();
        /* onion state is visible on the button */
    }

    function stopPreview() {
        if (!previewInterval) return;
        clearInterval(previewInterval);
        previewInterval = null;
        els.preview.textContent = 'Preview';
        const playBtn = els.filmstrip.querySelector('.frame-thumb.play');
        if (playBtn) {
            playBtn.textContent = '▶';
            playBtn.title = 'Play';
        }
        redrawCanvas();
    }

    function previewAnimation() {
        if (previewInterval) {
            stopPreview();
            return;
        }
        if (frames.length < 2) return;
        const fps = Number(els.fps.value) || 4;
        let frameIndex = currentFrameIndex;
        els.preview.textContent = 'Stop';
        const playBtn = els.filmstrip.querySelector('.frame-thumb.play');
        if (playBtn) {
            playBtn.textContent = '■';
            playBtn.title = 'Stop preview';
        }
        previewInterval = setInterval(function () {
            frameIndex = (frameIndex + 1) % frames.length;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (currentStep === 1) {
                ctx.fillStyle = THEME.paper;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                drawCheckerboard(ctx, canvas.width, canvas.height);
            }
            const pixelMap = frames[frameIndex];
            for (let y = 0; y < gridH; y++) {
                for (let x = 0; x < gridW; x++) {
                    const color = pixelMap[y][x];
                    if (!color) continue;
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }, 1000 / fps);
    }

    function switchToStep(step) {
        stopPreview();
        currentStep = step;
        if (step === 1 || step === 2) lastDrawStep = step;
        els.app.setAttribute('data-step', String(step));
        if (els.hint) els.hint.textContent = HINTS[step];
        document.querySelectorAll('#modeSwitch [data-step]').forEach(function (btn) {
            btn.classList.toggle('on', Number(btn.getAttribute('data-step')) === step);
        });
        updateAnimationUi();
        if (step === 1) {
            setActiveTool('draw');
            setCurrentColor(INK);
        } else if (step === 2) {
            if (currentTool === 'erase' || currentTool === 'eyedrop') setActiveTool(currentTool);
            else setActiveTool('draw');
            if (isInk(currentColor) || toHex(currentColor) === toHex(PAPER)) {
                setCurrentColor(lastPaintColor || DEFAULT_PAINT);
            }
            createColorPalette();
        } else {
            updateExportVisibility();
        }
        canvas.style.cursor = step === 3 ? 'default' : 'crosshair';
        invalidateInsideMask();
        closePalette();
        requestAnimationFrame(function () { setCanvasSize(); });
        schedulePersist();
    }

    function showExportModal(title, previewEl, filename, blob, extraNote, opts) {
        opts = opts || {};
        const overlay = document.createElement('div');
        overlay.className = 'modal-root';
        const panel = document.createElement('div');
        panel.className = 'modal-panel';
        const heading = document.createElement('h3');
        heading.textContent = title;
        const imgBox = document.createElement('div');
        imgBox.className = 'modal-preview';
        imgBox.appendChild(previewEl);
        const note = document.createElement('p');
        note.style.cssText = 'margin:0;color:var(--muted);font-size:12px;text-align:center';
        note.textContent = extraNote || filename;
        const row = document.createElement('div');
        row.className = 'modal-actions';
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-accent';
        downloadBtn.textContent = 'Download';
        downloadBtn.addEventListener('click', function () { downloadBlob(blob, filename); });
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-muted';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        if (opts.shareFile && navigator.canShare && navigator.canShare({ files: [opts.shareFile] })) {
            const shareBtn = document.createElement('button');
            shareBtn.className = 'btn-accent';
            shareBtn.textContent = 'Share';
            shareBtn.addEventListener('click', function () {
                navigator.share({ files: [opts.shareFile], title: filename }).then(function () {
                    overlay.remove();
                }).catch(function (err) {
                    if (err && err.name === 'AbortError') return;
                    downloadBlob(blob, filename);
                });
            });
            downloadBtn.className = 'btn-muted';
            row.appendChild(shareBtn);
        }
        row.appendChild(downloadBtn);
        row.appendChild(closeBtn);
        panel.appendChild(heading);
        panel.appendChild(imgBox);
        panel.appendChild(note);
        panel.appendChild(row);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        function scalePreview() {
            const pw = previewEl.naturalWidth || previewEl.width;
            if (pw && pw <= 128) {
                previewEl.style.width = Math.max(192, pw * 4) + 'px';
                previewEl.style.height = 'auto';
            }
            previewEl.style.imageRendering = 'pixelated';
        }
        if (previewEl.tagName === 'IMG' && !previewEl.complete) {
            previewEl.addEventListener('load', scalePreview);
        } else {
            scalePreview();
        }
    }

    async function shareSticker() {
        try {
            setLoading(true, 'Preparing sticker...');
            const canvasOut = renderFrameToCanvas(frames[currentFrameIndex], {
                mode: 'sticker',
                transparent: true
            });
            const blob = await canvasToBlob(canvasOut, 'image/png');
            const filename = fileBase() + '-sticker-512.png';
            setLoading(false);
            const file = new File([blob], filename, { type: 'image/png' });
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.alt = filename;
            showExportModal('Sticker', img, filename, blob, '512×512 transparent sticker', {
                shareFile: file
            });
        } catch (err) {
            console.error(err);
            setLoading(false);
            showToast('Share failed');
        }
    }

    async function exportStill(kind) {
        try {
            setLoading(true, 'Exporting...');
            const frame = frames[currentFrameIndex];
            let canvasOut;
            let filename;
            let mime;
            let note;
            if (kind === 'png') {
                canvasOut = renderFrameToCanvas(frame, { mode: '1x', transparent: true });
                filename = fileBase() + '.png';
                mime = 'image/png';
                note = sizeLabel() + ' transparent PNG (true pixels)';
            } else if (kind === 'sticker') {
                canvasOut = renderFrameToCanvas(frame, { mode: 'sticker', transparent: true });
                filename = fileBase() + '-sticker-512.png';
                mime = 'image/png';
                note = '512×512 transparent sticker, integer-scaled pixels';
            } else {
                canvasOut = renderFrameToCanvas(frame, { mode: 'sticker', transparent: false, background: THEME.paper });
                filename = fileBase() + '.jpg';
                mime = 'image/jpeg';
                note = '512×512 JPG with white background';
            }
            const blob = await canvasToBlob(canvasOut, mime, 0.92);
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.alt = filename;
            setLoading(false);
            showExportModal(kind === 'sticker' ? 'Sticker' : kind.toUpperCase(), img, filename, blob, note);
        } catch (err) {
            console.error(err);
            setLoading(false);
            showToast('Export failed');
        }
    }

    function exportGif() {
        if (typeof GifEncoder === 'undefined') {
            showToast('GIF encoder failed to load');
            return;
        }
        if (!(isAnimationEnabled && frames.length > 1)) return;
        try {
            setLoading(true, 'Encoding GIF...');
            const fps = Number(els.fps.value) || 4;
            const delay = Math.max(2, Math.round(100 / fps));
            const rgbaFrames = frames.map(function (frame) {
                return canvasToRgba(renderFrameToCanvas(frame, { mode: 'sticker', transparent: true }));
            });
            const bytes = GifEncoder.encode(rgbaFrames, STICKER_SIZE, STICKER_SIZE, {
                delay: delay,
                loop: 0,
                transparent: true
            });
            const blob = new Blob([bytes], { type: 'image/gif' });
            const filename = fileBase() + '-' + fps + 'fps.gif';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.alt = filename;
            setLoading(false);
            showExportModal('Animated GIF', img, filename, blob, '512×512 looping GIF at ' + fps + ' fps');
        } catch (err) {
            console.error(err);
            setLoading(false);
            showToast('GIF export failed');
        }
    }

    function showAllFrames() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-root';
        const panel = document.createElement('div');
        panel.className = 'modal-panel';
        const heading = document.createElement('h3');
        heading.textContent = 'All frames';
        const scroller = document.createElement('div');
        scroller.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
        frames.forEach(function (frame, index) {
            const card = document.createElement('div');
            card.style.cssText = 'border:1px solid var(--line);border-radius:12px;overflow:hidden';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 8px;font-size:12px';
            head.innerHTML = '<span>Frame ' + (index + 1) + '</span>';
            const save = document.createElement('button');
            save.className = 'ghost';
            save.textContent = 'Save';
            const c = renderFrameToCanvas(frame, { mode: 'sticker', transparent: true });
            save.addEventListener('click', function () {
                c.toBlob(function (blob) {
                    if (blob) downloadBlob(blob, fileBase() + '-frame-' + (index + 1) + '.png');
                }, 'image/png');
            });
            head.appendChild(save);
            const imgWrap = document.createElement('div');
            imgWrap.className = 'modal-preview';
            const img = document.createElement('img');
            img.src = c.toDataURL('image/png');
            imgWrap.appendChild(img);
            card.appendChild(head);
            card.appendChild(imgWrap);
            scroller.appendChild(card);
        });
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn-muted';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function () { overlay.remove(); });
        panel.appendChild(heading);
        panel.appendChild(scroller);
        panel.appendChild(closeBtn);
        overlay.appendChild(panel);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    async function saveProjectFile() {
        await persistNow();
        const filename = fileBase() + '.json';
        const json = JSON.stringify(serializeProject(), null, 2);
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'Pixel Canvas project', accept: { 'application/json': ['.json'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                showToast('Saved ' + filename, 'success');
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }
        downloadBlob(new Blob([json], { type: 'application/json' }), filename);
        showToast('Backup saved. Open backup to reload it.', 'success');
    }

    function loadProjectFile() {
        if (window.showOpenFilePicker) {
            window.showOpenFilePicker({
                types: [{ description: 'Pixel Canvas project', accept: { 'application/json': ['.json'] } }],
                multiple: false
            }).then(function (handles) {
                if (!handles || !handles[0]) return;
                return handles[0].getFile();
            }).then(function (file) {
                if (file) readProjectFile(file);
            }).catch(function (err) {
                if (err && err.name === 'AbortError') return;
                els.projectInput.value = '';
                els.projectInput.click();
            });
            return;
        }
        els.projectInput.value = '';
        els.projectInput.click();
    }

    function readProjectFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            try {
                let data = JSON.parse(reader.result);
                if (!Array.isArray(data.frames) && window.PixelStore) {
                    data = PixelStore.unpackData(data);
                }
                persistNow().then(function () {
                    currentId = newId();
                    projectName = (file.name || 'Untitled').replace(/\.json$/i, '').slice(0, 24);
                    loadProjectObject(data);
                    updateNameUi();
                    closeLibrary();
                });
            } catch (err) {
                console.error(err);
                showToast('Could not open project');
            }
        };
        reader.readAsText(file);
    }

    async function clearCanvas() {
        closeMore();
        if (!frameHasPixels()) return;
        const ok = await confirmAction(
            'Clear this frame?',
            'The drawing will be emptied. Undo can restore it.',
            'Clear'
        );
        if (!ok) return;
        frames[currentFrameIndex] = createEmptyFrame(gridW, gridH);
        redrawCanvas();
        saveToHistory();
        renderFilmstrip();
        showToast('Cleared. Undo to restore', 'info');
    }

    function clearColorsOnly() {
        const frame = frames[currentFrameIndex];
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (!isInk(frame[y][x])) frame[y][x] = null;
            }
        }
        redrawCanvas();
        saveToHistory();
        renderFilmstrip();
        closeMore();
    }

    function isMobileChrome() {
        return window.matchMedia && window.matchMedia('(max-width: 699px)').matches;
    }

    function openPalette() {
        if (!isMobileChrome() || currentStep !== 2) return;
        closeMore();
        els.app.setAttribute('data-palette', 'on');
        els.backdrop.classList.remove('is-hidden');
    }

    function closePalette() {
        els.app.setAttribute('data-palette', 'off');
        if (els.moreSheet && els.moreSheet.classList.contains('is-hidden')) {
            els.backdrop.classList.add('is-hidden');
        }
    }

    function toggleFocusMode() {
        const on = els.app.getAttribute('data-focus') === 'on';
        els.app.setAttribute('data-focus', on ? 'off' : 'on');
        const hide = !on;
        if (els.focusBtn) {
            els.focusBtn.classList.toggle('on', hide);
            els.focusBtn.title = hide ? 'Show tools' : 'Hide tools';
        }
        const sheetFocus = document.getElementById('sheetFocus');
        if (sheetFocus) sheetFocus.textContent = hide ? 'Show tools' : 'Hide tools';
        requestAnimationFrame(function () { setCanvasSize(); });
    }

    function openMore() {
        closePalette();
        els.moreSheet.classList.remove('is-hidden');
        els.backdrop.classList.remove('is-hidden');
        document.getElementById('sheetCopy').classList.toggle('is-hidden', !isAnimationEnabled);
        document.getElementById('sheetOnion').classList.toggle('is-hidden', !isAnimationEnabled);
        document.getElementById('sheetSaveColor').classList.add('is-hidden');
        document.getElementById('sheetGrid').classList.add('is-hidden');
        document.getElementById('sheetAnim').classList.add('is-hidden');
        document.getElementById('sheetEyedrop').classList.add('is-hidden');
        document.getElementById('sheetClearColors').classList.toggle('is-hidden', currentStep !== 2);
        const sheetMode = document.getElementById('sheetMode');
        if (sheetMode) sheetMode.classList.add('is-hidden');
        const colorKicker = document.getElementById('sheetColorKicker');
        if (colorKicker) colorKicker.classList.toggle('is-hidden', currentStep !== 2);
        const frameKicker = document.getElementById('sheetFrameKicker');
        if (frameKicker) frameKicker.classList.toggle('is-hidden', !isAnimationEnabled);
        const sheetFocus = document.getElementById('sheetFocus');
        if (sheetFocus) {
            sheetFocus.textContent = els.app.getAttribute('data-focus') === 'on' ? 'Show tools' : 'Hide tools';
        }
    }

    function closeMore() {
        els.moreSheet.classList.add('is-hidden');
        if (els.app.getAttribute('data-palette') !== 'on') {
            els.backdrop.classList.add('is-hidden');
        }
    }

    function isTypingTarget(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
    }

    canvas.addEventListener('mousedown', function (e) {
        if (e.button !== 2) e.preventDefault();
        handlePointerDown(e);
    });
    canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (currentStep === 3) return;
        const cell = eventToGrid(e);
        pickColorAt(cell.x, cell.y);
    });
    canvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mousemove', function (e) {
        if (panning) handlePointerMove(e);
    });
    window.addEventListener('mouseup', handlePointerUp);
    canvas.addEventListener('mouseleave', function () {
        if (!panning) handlePointerUp();
    });
    const stage = els.canvasStage || canvas;
    stage.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            clearPressTimer();
            pendingTap = null;
            lastTap = null;
            let cancelledStroke = false;
            if (isDrawing && strokeDirty && historyIndex >= 0) {
                applySnapshot(history[historyIndex]);
                cancelledStroke = true;
            }
            isDrawing = false;
            strokeDirty = false;
            lastStrokeCell = null;
            const d = touchDist(e.touches[0], e.touches[1]);
            const m = touchMid(e.touches[0], e.touches[1]);
            pinch = {
                dist: d || 1,
                scale: viewScale,
                x: viewX,
                y: viewY,
                midX: m.x,
                midY: m.y,
                t: Date.now(),
                moved: false,
                cancelledStroke: cancelledStroke
            };
            return;
        }
        if (e.touches.length === 1 && !pinch) handlePointerDown(e);
    }, { passive: false });
    stage.addEventListener('touchmove', function (e) {
        e.preventDefault();
        if (e.touches.length >= 2) {
            if (!pinch) {
                const d = touchDist(e.touches[0], e.touches[1]);
                const m = touchMid(e.touches[0], e.touches[1]);
                pinch = {
                    dist: d || 1,
                    scale: viewScale,
                    x: viewX,
                    y: viewY,
                    midX: m.x,
                    midY: m.y,
                    t: Date.now(),
                    moved: false
                };
            }
            const d = touchDist(e.touches[0], e.touches[1]);
            const m = touchMid(e.touches[0], e.touches[1]);
            const scaleDelta = Math.abs(d / pinch.dist - 1);
            const move = Math.hypot(m.x - pinch.midX, m.y - pinch.midY);
            if (scaleDelta > 0.045 || move > 14) pinch.moved = true;
            if (!pinch.moved) return;
            viewScale = pinch.scale * (d / pinch.dist);
            viewX = pinch.x + (m.x - pinch.midX);
            viewY = pinch.y + (m.y - pinch.midY);
            clampView();
            applyView();
            return;
        }
        if (e.touches.length === 1 && !pinch) handlePointerMove(e);
    }, { passive: false });
    stage.addEventListener('touchend', function (e) {
        e.preventDefault();
        if (e.touches.length < 2) {
            pinch = null;
        }
        if (e.touches.length === 0) handlePointerUp();
    }, { passive: false });
    stage.addEventListener('wheel', function (e) {
        e.preventDefault();
        const old = viewScale;
        viewScale *= e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const rect = stage.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const k = viewScale / (old || 1);
        viewX = cx - (cx - viewX) * k;
        viewY = cy - (cy - viewY) * k;
        clampView();
        applyView();
    }, { passive: false });

    document.querySelectorAll('#modeSwitch [data-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchToStep(Number(btn.getAttribute('data-step')));
        });
    });
    document.querySelectorAll('[data-tool]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setActiveTool(btn.getAttribute('data-tool'));
        });
    });

    els.undo.addEventListener('click', undo);
    els.redo.addEventListener('click', redo);
    els.grid.addEventListener('click', function () {
        showGrid = !showGrid;
        els.grid.classList.toggle('on', showGrid);
        redrawCanvas();
        drawOverlayGrid();
    });
    els.animToggle.addEventListener('click', function () { toggleAnimation(); });
    els.shareBtn.addEventListener('click', function () { shareSticker(); });
    els.copyPrev.addEventListener('click', copyPreviousFrame);
    els.onion.addEventListener('click', toggleOnion);
    document.getElementById('uploadBtn').addEventListener('click', uploadImage);
    document.getElementById('clearBtn').addEventListener('click', clearCanvas);
    document.getElementById('addColorBtn').addEventListener('click', function () {
        els.colorPicker.click();
    });
    els.colorPicker.addEventListener('input', function (e) {
        snapFromPicker(e.target.value);
    });

    document.getElementById('exportPngBtn').addEventListener('click', function () { exportStill('png'); });
    document.getElementById('exportStickerBtn').addEventListener('click', function () { shareSticker(); });
    els.exportGif.addEventListener('click', exportGif);
    els.saveAll.addEventListener('click', showAllFrames);
    els.preview.addEventListener('click', previewAnimation);
    document.getElementById('saveProjectBtn').addEventListener('click', saveProjectFile);
    document.getElementById('loadProjectBtn').addEventListener('click', loadProjectFile);
    els.fps.addEventListener('change', function () {
        if (previewInterval) {
            stopPreview();
            previewAnimation();
        }
        schedulePersist();
    });

    els.moreBtn.addEventListener('click', openMore);
    els.backdrop.addEventListener('click', function () {
        closeMore();
        closePalette();
    });
    if (els.colorFab) {
        els.colorFab.addEventListener('click', function () {
            if (els.app.getAttribute('data-palette') === 'on') closePalette();
            else openPalette();
        });
    }
    if (els.paletteClose) {
        els.paletteClose.addEventListener('click', function () {
            if (currentStep === 3) switchToStep(lastDrawStep || 1);
            else closePalette();
        });
    }
    if (els.focusBtn) els.focusBtn.addEventListener('click', toggleFocusMode);
    if (els.focusPeek) els.focusPeek.addEventListener('click', toggleFocusMode);
    if (els.drawModeBtn) {
        els.drawModeBtn.addEventListener('click', function () {
            switchToStep(currentStep === 1 ? 2 : 1);
        });
    }
    if (els.exportHudBtn) {
        els.exportHudBtn.addEventListener('click', function () {
            closePalette();
            closeMore();
            switchToStep(3);
        });
    }
    const sheetMode = document.getElementById('sheetMode');
    if (sheetMode) {
        sheetMode.addEventListener('click', function () {
            closeMore();
            switchToStep(currentStep === 2 ? 1 : 2);
        });
    }
    const sheetEyedrop = document.getElementById('sheetEyedrop');
    if (sheetEyedrop) {
        sheetEyedrop.addEventListener('click', function () {
            closeMore();
            setActiveTool('eyedrop');
        });
    }
    const sheetFocus = document.getElementById('sheetFocus');
    if (sheetFocus) {
        sheetFocus.addEventListener('click', function () {
            closeMore();
            toggleFocusMode();
        });
    }
    const sheetAnim = document.getElementById('sheetAnim');
    if (sheetAnim) {
        sheetAnim.addEventListener('click', function () {
            closeMore();
            toggleAnimation();
        });
    }
    document.getElementById('sheetClose').addEventListener('click', closeMore);
    document.getElementById('sheetUpload').addEventListener('click', uploadImage);
    document.getElementById('sheetClear').addEventListener('click', clearCanvas);
    document.getElementById('sheetClearColors').addEventListener('click', clearColorsOnly);
    document.getElementById('sheetCopy').addEventListener('click', function () { closeMore(); copyPreviousFrame(); });
    document.getElementById('sheetOnion').addEventListener('click', function () { closeMore(); toggleOnion(); });
    document.getElementById('sheetGrid').addEventListener('click', function () {
        closeMore();
        showGrid = !showGrid;
        els.grid.classList.toggle('on', showGrid);
        redrawCanvas();
    });
    document.getElementById('sheetSaveColor').addEventListener('click', function () {
        closeMore();
        els.colorPicker.click();
    });

    els.fileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (file) onImageChosen(file);
    });
    els.projectInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        readProjectFile(file);
    });

    if (els.zoomReset) {
        els.zoomReset.addEventListener('click', function () {
            if (currentStep !== 3 && viewIsIdle() && displayCellSize() < 8) {
                const stage = els.canvasStage || canvas;
                const rect = stage.getBoundingClientRect();
                toggleZoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
                return;
            }
            resetView();
        });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        if (els.installBtn) els.installBtn.classList.remove('is-hidden');
    });
    if (els.installBtn) {
        els.installBtn.addEventListener('click', function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt = null;
            els.installBtn.classList.add('is-hidden');
        });
    }
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches && els.installBtn) {
        els.installBtn.classList.add('is-hidden');
    }

    function applyIosSafeTopFallback() {
        const ua = navigator.userAgent || '';
        const isiOS = /iP(hone|ad|od)/.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const standalone = window.navigator.standalone === true
            || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        if (!isiOS || !standalone) {
            document.documentElement.style.setProperty('--safe-top-extra', '0px');
            return;
        }

        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
        document.body.appendChild(probe);
        const inset = probe.getBoundingClientRect().height;
        probe.remove();
        if (inset > 0) {
            document.documentElement.style.setProperty('--safe-top-extra', '0px');
            return;
        }

        const vv = window.visualViewport;
        if (vv && vv.offsetTop > 0) {
            document.documentElement.style.setProperty('--safe-top-extra', '0px');
            return;
        }

        const portrait = window.innerHeight >= window.innerWidth;
        const screenGap = Math.max(0, window.screen.height - window.innerHeight);
        if (portrait && screenGap < 20) {
            document.documentElement.style.setProperty('--safe-top-extra', '54px');
        } else {
            document.documentElement.style.setProperty('--safe-top-extra', '0px');
        }
    }
    applyIosSafeTopFallback();
    window.addEventListener('resize', applyIosSafeTopFallback);
    window.addEventListener('orientationchange', function () {
        setTimeout(applyIosSafeTopFallback, 300);
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
    }

    window.addEventListener('keydown', function (e) {
        const key = e.key.toLowerCase();
        if (key === 'escape') {
            closeMore();
            closePalette();
            closeLibrary();
            if (newCanvasResolver && newCanvasAllowCancel) closeNewCanvasDialog(null);
            return;
        }
        if (e.code === 'Space' && !isTypingTarget(e.target)) {
            spaceDown = true;
            if (currentStep !== 3) e.preventDefault();
        }
        if (isTypingTarget(e.target)) return;
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && key === 'y') {
            e.preventDefault();
            redo();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (key === '1') switchToStep(1);
        else if (key === '2') switchToStep(2);
        else if (key === '3') switchToStep(3);
        else if (key === 'b') setActiveTool('draw');
        else if (key === 'e') setActiveTool('erase');
        else if (key === 'f') setActiveTool('fill');
        else if (key === 'i') setActiveTool('eyedrop');
        else if (key === 'g') {
            showGrid = !showGrid;
            els.grid.classList.toggle('on', showGrid);
            redrawCanvas();
        } else if (key === '[' && isAnimationEnabled) goToFrame(currentFrameIndex - 1);
        else if (key === ']' && isAnimationEnabled) goToFrame(currentFrameIndex + 1);
        else if (key === ' ' && currentStep === 3) {
            e.preventDefault();
            previewAnimation();
        }
    });
    window.addEventListener('keyup', function (e) {
        if (e.code === 'Space') spaceDown = false;
    });

    window.addEventListener('resize', setCanvasSize);
    window.addEventListener('beforeunload', persistNow);
    if (window.ResizeObserver) {
        new ResizeObserver(function () { setCanvasSize(); }).observe(els.bezel);
    }

    els.libraryBtn.addEventListener('click', openLibrary);
    els.libraryClose.addEventListener('click', closeLibrary);
    els.libraryRoot.addEventListener('click', function (e) {
        if (e.target === els.libraryRoot) closeLibrary();
    });
    els.newProjectBtn.addEventListener('click', function () { startNewProject(); });
    els.deleteProjectBtn.addEventListener('click', function () { deleteCurrent(); });
    if (els.librarySaveBtn) els.librarySaveBtn.addEventListener('click', function () { saveProjectFile(); });
    if (els.libraryOpenBtn) els.libraryOpenBtn.addEventListener('click', function () { loadProjectFile(); });
    if (els.newCanvasCancel) {
        els.newCanvasCancel.addEventListener('click', function () {
            if (newCanvasAllowCancel) closeNewCanvasDialog(null);
        });
    }
    if (els.newCanvasCreate) {
        els.newCanvasCreate.addEventListener('click', function () {
            closeNewCanvasDialog(canvasSizeFor(newCanvasPick.ratio, newCanvasPick.orientation, newCanvasPick.density));
        });
    }
    if (els.newCanvasRoot) {
        els.newCanvasRoot.addEventListener('click', function (e) {
            if (e.target === els.newCanvasRoot && newCanvasAllowCancel) closeNewCanvasDialog(null);
        });
    }
    if (els.sideLibraryBtn) els.sideLibraryBtn.addEventListener('click', openLibrary);
    if (els.projectNameInput) els.projectNameInput.addEventListener('input', onNameInput);
    if (els.sideNameInput) els.sideNameInput.addEventListener('input', onNameInput);

    els.grid.classList.add('on');
    updateSizeChip();
    setCanvasSize();
    els.currentColor.style.backgroundColor = currentColor;
    if (els.colorFab) els.colorFab.style.backgroundColor = currentColor;
    updateHistoryButtons();

    (async function boot() {
        try {
            if (window.PixelStore) await PixelStore.open();
            const id = window.PixelStore ? await PixelStore.getCurrentId() : null;
            const rec = id && window.PixelStore ? await PixelStore.load(id) : null;
            if (rec && rec.data) {
                currentId = rec.id;
                projectName = rec.name || 'Untitled';
                loadProjectObject(PixelStore.unpackData(rec.data), { silent: true, skipPersist: true });
            } else if (!restoreAutosave()) {
                currentId = newId();
                projectName = await nextUntitledName();
                const size = await openNewCanvasDialog({ allowCancel: false });
                resetDrawing(size && size.w ? size.w : 64, size && size.h ? size.h : 64);
                updateNameUi();
                await persistNow();
            } else if (!currentId) {
                currentId = newId();
                projectName = 'Untitled';
                schedulePersist();
            }
        } catch (err) {
            console.warn(err);
            if (!currentId) currentId = newId();
            saveToHistory();
            switchToStep(1);
        }
        updateNameUi();
        renderShelf();
    })();
});
