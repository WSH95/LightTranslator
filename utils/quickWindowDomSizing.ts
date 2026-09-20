import {
  chooseQuickWindowDimensions,
  type QuickWindowDimensions,
} from './quickWindowSizing';

interface QuickWindowLayoutElements {
  header: HTMLElement;
  body: HTMLElement;
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
    const intrinsicBody = cloneForMeasurement(elements.body, 'max-content');
    host.append(intrinsicHeader, intrinsicBody);

    const toolbarWidth = renderedWidth(intrinsicHeader);
    const intrinsicContentWidth = renderedWidth(intrinsicBody);
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
    const wrappedBody = cloneForMeasurement(elements.body, width);
    const wrappedFooter = elements.footer
      ? cloneForMeasurement(elements.footer, width)
      : null;
    host.append(wrappedHeader, wrappedBody);
    if (wrappedFooter) host.append(wrappedFooter);

    const menuRequiredHeight = elements.menu && menuRect
      ? menuRect.top + elements.menu.scrollHeight + MENU_MARGIN
      : undefined;

    return chooseQuickWindowDimensions({
      intrinsicContentWidth,
      toolbarWidth,
      headerHeight: renderedHeight(wrappedHeader),
      wrappedContentHeight: renderedHeight(wrappedBody),
      footerHeight: wrappedFooter ? renderedHeight(wrappedFooter) : 0,
      maximumWidth: elements.maximumWidth,
      menuRequiredWidth,
      menuRequiredHeight,
    });
  } finally {
    host.remove();
  }
}
