import {
  chooseQuickWindowDimensions,
  type QuickWindowDimensions,
} from './quickWindowSizing';

interface QuickWindowLayoutElements {
  header: HTMLElement;
  scrollContainer: HTMLElement;
  footer: HTMLElement | null;
  menu: HTMLElement | null;
  maximumWidth: number;
}

const MENU_MARGIN = 8;

function createMeasurementHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: 'max-content',
    height: 'max-content',
    visibility: 'hidden',
    pointerEvents: 'none',
    overflow: 'visible',
    zIndex: '-1',
  });
  document.body.append(host);
  return host;
}

function cloneForMeasurement(source: HTMLElement, width: number | 'max-content'): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  Object.assign(clone.style, {
    position: 'static',
    inset: 'auto',
    transform: 'none',
    width: width === 'max-content' ? 'max-content' : `${width}px`,
    minWidth: '0',
    maxWidth: 'none',
    boxSizing: 'border-box',
    flex: 'none',
  });
  return clone;
}

function cloneScrollContainerForMeasurement(
  source: HTMLElement,
  width: number | 'max-content',
): HTMLElement {
  const clone = cloneForMeasurement(source, width);
  Object.assign(clone.style, {
    height: 'auto',
    minHeight: '0',
    maxHeight: 'none',
    // A scrollbar appearing during a resize can wrap an extra line and keep
    // itself visible. Reserve its real width in both measurement passes, so
    // the result fits even during that transition. The live container stays
    // overflow-y: auto and shows its scrollbar only when needed.
    overflowY: 'scroll',
  });
  return clone;
}

function renderedWidth(element: HTMLElement): number {
  return Math.max(element.getBoundingClientRect().width, element.scrollWidth);
}

function renderedHeight(element: HTMLElement): number {
  return Math.max(element.getBoundingClientRect().height, element.scrollHeight);
}

/**
 * Measures clones outside the viewport-sized application root. The first pass
 * uses max-content width, so words, CJK, emoji and URLs are measured by the
 * active browser font rather than estimated. The second pass fixes the chosen
 * width and reads the real wrapped height.
 */
export function measureQuickWindowLayout(
  elements: QuickWindowLayoutElements,
): QuickWindowDimensions {
  const host = createMeasurementHost();
  try {
    const intrinsicHeader = cloneForMeasurement(elements.header, 'max-content');
    const intrinsicContent = cloneScrollContainerForMeasurement(elements.scrollContainer, 'max-content');
    host.append(intrinsicHeader, intrinsicContent);

    const toolbarWidth = renderedWidth(intrinsicHeader);
    const intrinsicContentWidth = renderedWidth(intrinsicContent);
    const menuRect = elements.menu?.getBoundingClientRect();
    const menuRequiredWidth = elements.menu && menuRect
      ? menuRect.left + Math.max(menuRect.width, elements.menu.scrollWidth) + MENU_MARGIN
      : undefined;
    const width = Math.ceil(Math.min(
      elements.maximumWidth,
      Math.max(toolbarWidth, intrinsicContentWidth, menuRequiredWidth ?? 0),
    ));

    host.replaceChildren();
    const wrappedHeader = cloneForMeasurement(elements.header, width);
    const wrappedContent = cloneScrollContainerForMeasurement(elements.scrollContainer, width);
    const wrappedFooter = elements.footer
      ? cloneForMeasurement(elements.footer, width)
      : null;
    host.append(wrappedHeader, wrappedContent);
    if (wrappedFooter) host.append(wrappedFooter);

    const menuRequiredHeight = elements.menu && menuRect
      ? menuRect.top + elements.menu.scrollHeight + MENU_MARGIN
      : undefined;

    return chooseQuickWindowDimensions({
      intrinsicContentWidth,
      toolbarWidth,
      headerHeight: renderedHeight(wrappedHeader),
      wrappedContentHeight: renderedHeight(wrappedContent),
      footerHeight: wrappedFooter ? renderedHeight(wrappedFooter) : 0,
      maximumWidth: elements.maximumWidth,
      menuRequiredWidth,
      menuRequiredHeight,
    });
  } finally {
    host.remove();
  }
}
