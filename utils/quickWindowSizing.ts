export interface QuickWindowDimensions {
  width: number;
  height: number;
}

export interface QuickWindowMeasurements {
  intrinsicContentWidth: number;
  toolbarWidth: number;
  headerHeight: number;
  wrappedContentHeight: number;
  footerHeight: number;
  maximumWidth: number;
  menuRequiredWidth?: number;
  menuRequiredHeight?: number;
}

export const QUICK_WINDOW_MIN_HEIGHT = 80;
export const QUICK_WINDOW_MAX_HEIGHT = 500;

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function chooseQuickWindowDimensions(
  measurements: QuickWindowMeasurements,
): QuickWindowDimensions {
  const maximumWidth = Math.max(1, Math.round(finiteNonNegative(measurements.maximumWidth)));
  const desiredWidth = Math.max(
    finiteNonNegative(measurements.intrinsicContentWidth),
    finiteNonNegative(measurements.toolbarWidth),
    finiteNonNegative(measurements.menuRequiredWidth ?? 0),
  );
  const contentHeight =
    finiteNonNegative(measurements.headerHeight)
    + finiteNonNegative(measurements.wrappedContentHeight)
    + finiteNonNegative(measurements.footerHeight);
  const desiredHeight = Math.max(
    contentHeight,
    finiteNonNegative(measurements.menuRequiredHeight ?? 0),
  );

  return {
    width: Math.ceil(Math.min(maximumWidth, desiredWidth)),
    height: Math.ceil(
      Math.min(QUICK_WINDOW_MAX_HEIGHT, Math.max(QUICK_WINDOW_MIN_HEIGHT, desiredHeight)),
    ),
  };
}

interface ResizeCoordinatorOptions {
  measure: () => QuickWindowDimensions | null;
  resize: (dimensions: QuickWindowDimensions) => Promise<void>;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
  onError?: (error: unknown) => void;
}

export class QuickWindowResizeCoordinator {
  private readonly measure: ResizeCoordinatorOptions['measure'];
  private readonly resize: ResizeCoordinatorOptions['resize'];
  private readonly requestFrame: NonNullable<ResizeCoordinatorOptions['requestFrame']>;
  private readonly cancelFrame: NonNullable<ResizeCoordinatorOptions['cancelFrame']>;
  private readonly onError: NonNullable<ResizeCoordinatorOptions['onError']>;
  private frame: number | null = null;
  private resizeRunning = false;
  private invalidated = false;
  private disposed = false;
  private lastApplied: QuickWindowDimensions | null = null;

  constructor(options: ResizeCoordinatorOptions) {
    this.measure = options.measure;
    this.resize = options.resize;
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.onError = options.onError ?? ((error) => console.error('Failed to resize quick window:', error));
  }

  request(): void {
    if (this.disposed) return;
    this.invalidated = true;
    if (this.resizeRunning || this.frame !== null) return;
    this.frame = this.requestFrame(() => {
      this.frame = null;
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (this.disposed || this.resizeRunning || !this.invalidated) return;
    this.invalidated = false;
    const next = this.measure();
    if (!next || this.sameDimensions(next, this.lastApplied)) {
      if (this.invalidated) this.request();
      return;
    }

    this.resizeRunning = true;
    try {
      await this.resize(next);
      if (!this.disposed) this.lastApplied = next;
    } catch (error) {
      if (!this.disposed) this.onError(error);
    } finally {
      this.resizeRunning = false;
      if (!this.disposed && this.invalidated) this.request();
    }
  }

  private sameDimensions(
    first: QuickWindowDimensions,
    second: QuickWindowDimensions | null,
  ): boolean {
    return second !== null && first.width === second.width && first.height === second.height;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.invalidated = false;
    if (this.frame !== null) {
      this.cancelFrame(this.frame);
      this.frame = null;
    }
  }
}
