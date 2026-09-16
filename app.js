import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const els = {
  appShell: document.getElementById('appShell'),
  viewer: document.getElementById('viewer'),
  emptyState: document.getElementById('emptyState'),
  documentView: document.getElementById('documentView'),
  viewport: document.getElementById('viewport'),
  canvas: document.getElementById('pdfCanvas'),
  toolbar: document.getElementById('toolbar'),
  openButton: document.getElementById('openButton'),
  emptyOpenButton: document.getElementById('emptyOpenButton'),
  fileInput: document.getElementById('fileInput'),
  fileName: document.getElementById('fileName'),
  fileSummary: document.getElementById('fileSummary'),
  statusDot: document.getElementById('statusDot'),
  dropOverlay: document.getElementById('dropOverlay'),
  message: document.getElementById('message'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageNumber: document.getElementById('pageNumber'),
  pageCount: document.getElementById('pageCount'),
  zoomOut: document.getElementById('zoomOut'),
  zoomIn: document.getElementById('zoomIn'),
  actualSize: document.getElementById('actualSize'),
  zoomValue: document.getElementById('zoomValue'),
  fitButton: document.getElementById('fitButton'),
  fullscreenButton: document.getElementById('fullscreenButton'),
};

const state = {
  pdf: null,
  page: 1,
  scale: 1,
  fitMode: true,
  renderTask: null,
  renderToken: 0,
  dragDepth: 0,
  panning: false,
  panStartX: 0,
  panStartY: 0,
  panScrollLeft: 0,
  panScrollTop: 0,
  spacePressed: false,
  messageTimer: null,
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const SCALE_STEP = 1.2;

function chooseFile() {
  els.fileInput.value = '';
  els.fileInput.click();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function showMessage(text, type = 'info', timeout = 4200) {
  clearTimeout(state.messageTimer);
  els.message.textContent = text;
  els.message.className = `message ${type === 'error' ? 'error' : ''}`.trim();
  els.message.hidden = false;
  if (timeout) {
    state.messageTimer = setTimeout(() => {
      els.message.hidden = true;
    }, timeout);
  }
}

function hideMessage() {
  clearTimeout(state.messageTimer);
  els.message.hidden = true;
}

function setLoadedUI(file) {
  els.emptyState.hidden = true;
  els.documentView.hidden = false;
  els.toolbar.hidden = false;
  els.fileName.textContent = file.name;
  els.fileSummary.title = `${file.name} · ${formatBytes(file.size)}`;
  els.statusDot.classList.add('ready');
  updateControls();
}

function setLoadingUI(file) {
  els.fileName.textContent = `Opening ${file.name}…`;
  els.fileSummary.title = file.name;
  els.statusDot.classList.remove('ready');
}

function updateControls() {
  const pages = state.pdf?.numPages ?? 1;
  els.pageNumber.textContent = String(state.page);
  els.pageCount.textContent = String(pages);
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= pages;
  els.zoomValue.textContent = `${Math.round(state.scale * 100)}%`;
  els.fitButton.setAttribute('aria-pressed', String(state.fitMode));
}

function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

async function calculateFitScale(page) {
  const viewport = page.getViewport({ scale: 1 });
  const padding = window.innerWidth <= 560 ? 48 : 84;
  const availableWidth = Math.max(100, els.viewport.clientWidth - padding);
  const availableHeight = Math.max(100, els.viewport.clientHeight - padding);
  return clampScale(Math.min(
    availableWidth / viewport.width,
    availableHeight / viewport.height,
  ));
}

async function renderCurrentPage({ preserveCenter = false } = {}) {
  if (!state.pdf) return;

  const token = ++state.renderToken;
  const page = await state.pdf.getPage(state.page);
  if (token !== state.renderToken) return;

  if (state.fitMode) {
    state.scale = await calculateFitScale(page);
  }

  const oldCenter = preserveCenter
    ? {
        x: (els.viewport.scrollLeft + els.viewport.clientWidth / 2) / Math.max(1, els.viewport.scrollWidth),
        y: (els.viewport.scrollTop + els.viewport.clientHeight / 2) / Math.max(1, els.viewport.scrollHeight),
      }
    : null;

  const viewport = page.getViewport({ scale: state.scale });
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const context = els.canvas.getContext('2d', { alpha: false });

  if (state.renderTask) {
    try {
      state.renderTask.cancel();
    } catch (_) {
      // Ignore cancellation races.
    }
  }

  els.canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
  els.canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
  els.canvas.style.width = `${viewport.width}px`;
  els.canvas.style.height = `${viewport.height}px`;

  state.renderTask = page.render({
    canvasContext: context,
    viewport,
    transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
    background: '#ffffff',
  });

  try {
    await state.renderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
    return;
  } finally {
    state.renderTask = null;
  }

  if (token !== state.renderToken) return;

  updateControls();

  requestAnimationFrame(() => {
    if (state.fitMode || !oldCenter) {
      els.viewport.scrollLeft = Math.max(0, (els.viewport.scrollWidth - els.viewport.clientWidth) / 2);
      els.viewport.scrollTop = Math.max(0, (els.viewport.scrollHeight - els.viewport.clientHeight) / 2);
      return;
    }

    els.viewport.scrollLeft = Math.max(0, oldCenter.x * els.viewport.scrollWidth - els.viewport.clientWidth / 2);
    els.viewport.scrollTop = Math.max(0, oldCenter.y * els.viewport.scrollHeight - els.viewport.clientHeight / 2);
  });
}

async function setScale(scale) {
  state.fitMode = false;
  state.scale = clampScale(scale);
  updateControls();
  await renderCurrentPage({ preserveCenter: true });
}

async function fitToView() {
  if (!state.pdf) return;
  state.fitMode = true;
  await renderCurrentPage();
}

async function changePage(delta) {
  if (!state.pdf) return;
  const next = Math.min(state.pdf.numPages, Math.max(1, state.page + delta));
  if (next === state.page) return;
  state.page = next;
  await renderCurrentPage();
}

function looksLikePdfCompatibleAI(bytes) {
  const scanLength = Math.min(bytes.length, 8192);
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, scanLength));
  return text.includes('%PDF-');
}

async function openFile(file) {
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['ai', 'pdf'].includes(extension)) {
    showMessage('Please choose an .ai or .pdf file.', 'error');
    return;
  }

  hideMessage();
  setLoadingUI(file);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (extension === 'ai' && !looksLikePdfCompatibleAI(bytes)) {
      throw new Error('This AI file does not appear to contain a PDF-compatible representation. Re-save it from Illustrator with “Create PDF Compatible File” enabled.');
    }

    if (state.pdf) {
      try {
        await state.pdf.destroy();
      } catch (_) {
        // Safe to continue with the new document.
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    state.pdf = await loadingTask.promise;
    state.page = 1;
    state.scale = 1;
    state.fitMode = true;

    setLoadedUI(file);
    await renderCurrentPage();

    const typeLabel = extension === 'ai' ? 'PDF-compatible AI' : 'PDF';
    showMessage(`${typeLabel} opened locally · ${state.pdf.numPages} page${state.pdf.numPages === 1 ? '' : 's'} · ${formatBytes(file.size)}`);
    els.viewport.focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    els.statusDot.classList.remove('ready');
    els.fileName.textContent = 'Could not open file';
    showMessage(error?.message || 'This file could not be rendered.', 'error', 0);
  }
}

els.openButton.addEventListener('click', chooseFile);
els.emptyOpenButton.addEventListener('click', chooseFile);
els.fileInput.addEventListener('change', (event) => openFile(event.target.files?.[0]));

els.prevPage.addEventListener('click', () => changePage(-1));
els.nextPage.addEventListener('click', () => changePage(1));
els.zoomOut.addEventListener('click', () => setScale(state.scale / SCALE_STEP));
els.zoomIn.addEventListener('click', () => setScale(state.scale * SCALE_STEP));
els.actualSize.addEventListener('click', () => setScale(1));
els.fitButton.addEventListener('click', fitToView);

els.fullscreenButton.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await els.appShell.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    showMessage('Fullscreen is not available in this browser.', 'error');
  }
});

els.viewport.addEventListener('wheel', (event) => {
  if (!state.pdf || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.002);
  setScale(state.scale * factor);
}, { passive: false });

els.viewport.addEventListener('pointerdown', (event) => {
  if (!state.pdf || event.button !== 0) return;
  state.panning = true;
  state.panStartX = event.clientX;
  state.panStartY = event.clientY;
  state.panScrollLeft = els.viewport.scrollLeft;
  state.panScrollTop = els.viewport.scrollTop;
  els.viewport.classList.add('dragging');
  els.viewport.setPointerCapture(event.pointerId);
});

els.viewport.addEventListener('pointermove', (event) => {
  if (!state.panning) return;
  els.viewport.scrollLeft = state.panScrollLeft - (event.clientX - state.panStartX);
  els.viewport.scrollTop = state.panScrollTop - (event.clientY - state.panStartY);
});

function endPan(event) {
  if (!state.panning) return;
  state.panning = false;
  els.viewport.classList.remove('dragging');
  try {
    els.viewport.releasePointerCapture(event.pointerId);
  } catch (_) {
    // Pointer may already be released.
  }
}

els.viewport.addEventListener('pointerup', endPan);
els.viewport.addEventListener('pointercancel', endPan);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.code === 'ArrowLeft' || event.code === 'PageUp') {
    event.preventDefault();
    changePage(-1);
  } else if (event.code === 'ArrowRight' || event.code === 'PageDown') {
    event.preventDefault();
    changePage(1);
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    setScale(state.scale * SCALE_STEP);
  } else if (event.key === '-') {
    event.preventDefault();
    setScale(state.scale / SCALE_STEP);
  } else if (event.key === '0') {
    event.preventDefault();
    fitToView();
  } else if (event.key === '1') {
    event.preventDefault();
    setScale(1);
  }
});

['dragenter', 'dragover'].forEach((type) => {
  window.addEventListener(type, (event) => {
    event.preventDefault();
    if (type === 'dragenter') state.dragDepth += 1;
    els.dropOverlay.hidden = false;
  });
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) els.dropOverlay.hidden = true;
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  state.dragDepth = 0;
  els.dropOverlay.hidden = true;
  openFile(event.dataTransfer?.files?.[0]);
});

const resizeObserver = new ResizeObserver(() => {
  if (!state.pdf || !state.fitMode) return;
  clearTimeout(resizeObserver.timer);
  resizeObserver.timer = setTimeout(() => renderCurrentPage(), 120);
});
resizeObserver.observe(els.viewport);

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error?.name === 'RenderingCancelledException') return;
  console.error(error);
});
