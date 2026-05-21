type DownloadModalOptions = {
  onDownloadImage: () => void | Promise<void>;
  onDownloadVector: () => void | Promise<void>;
};

export type DownloadModal = {
  open: () => void;
  close: () => void;
  destroy: () => void;
};

export function createDownloadModal(host: HTMLElement, options: DownloadModalOptions): DownloadModal {
  const overlay = document.createElement('div');
  overlay.className = 'download-modal-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.tabIndex = -1;

  const dialog = document.createElement('div');
  dialog.className = 'download-modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'download-modal-title');

  dialog.innerHTML = `
    <div class="download-modal-header">
      <h2 class="download-modal-title" id="download-modal-title">Download artwork</h2>
      <button type="button" class="download-modal-close" data-download-modal-close aria-label="Close">×</button>
    </div>
    <div class="download-modal-body">
      <button type="button" class="download-modal-option download-modal-option--picture" data-download-image>
        <span class="download-modal-thumb" aria-hidden="true">
          <svg
            class="download-modal-thumb-svg"
            viewBox="0 0 56 48"
            focusable="false"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x="5" y="9" width="46" height="30" rx="0" fill="#e4edf5" stroke="#111111" stroke-width="1.75" />
            <path d="M 12 33 L 21 22 L 29 30 L 39 16 L 44 33 Z" fill="#6f92b0" />
            <circle cx="37" cy="17" r="3.75" fill="#fdde06" />
          </svg>
        </span>
        <span class="download-modal-option-text">
          <span class="download-modal-option-label">Picture</span>
          <span class="download-modal-option-hint download-modal-option-hint--desktop">JPEG · a gorgeous 4K image of your finished artboard</span>
          <span class="download-modal-option-hint download-modal-option-hint--mobile">JPEG · share, then tap Save Image to add to Photos</span>
        </span>
      </button>
      <button type="button" class="download-modal-option download-modal-option--vector" data-download-vector>
        <span class="download-modal-thumb" aria-hidden="true">
          <svg
            class="download-modal-thumb-svg"
            viewBox="0 0 56 48"
            focusable="false"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d="M 10 7 h29.5 L 46 13.5 V41 H10 Z"
              fill="#f4f6fb"
              stroke="#111111"
              stroke-width="1.75"
              stroke-linejoin="miter"
            />
            <path d="M 39.5 7 V13.5 H46" fill="none" stroke="#111111" stroke-width="1.75" stroke-linejoin="miter" />
            <path
              d="M 17 31 L 28 18 L 39 31"
              fill="none"
              stroke="#0300ad"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="download-modal-option-text">
          <span class="download-modal-option-label">Vector</span>
          <span class="download-modal-option-hint">SVG · for apps, print, or anyone who wants the extra-sharp copy</span>
        </span>
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  host.appendChild(overlay);

  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-download-modal-close]');
  const imageButton = dialog.querySelector<HTMLButtonElement>('[data-download-image]');
  const vectorButton = dialog.querySelector<HTMLButtonElement>('[data-download-vector]');

  let previouslyFocused: HTMLElement | null = null;

  const close = (): void => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    previouslyFocused?.focus();
    previouslyFocused = null;
  };

  const open = (): void => {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    (imageButton ?? closeButton)?.focus();
  };

  const onOverlayPointerDown = (event: MouseEvent): void => {
    if (event.target === overlay) {
      close();
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!overlay.classList.contains('is-open')) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const runAndClose = async (fn: () => void | Promise<void>): Promise<void> => {
    try {
      await fn();
    } finally {
      close();
    }
  };

  overlay.addEventListener('mousedown', onOverlayPointerDown);
  window.addEventListener('keydown', onKeyDown);

  closeButton?.addEventListener('click', () => {
    close();
  });

  imageButton?.addEventListener('click', () => {
    void runAndClose(options.onDownloadImage);
  });

  vectorButton?.addEventListener('click', () => {
    void runAndClose(options.onDownloadVector);
  });

  const destroy = (): void => {
    overlay.removeEventListener('mousedown', onOverlayPointerDown);
    window.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  return { open, close, destroy };
}
