import { useEffect } from 'react';
import type { Orientation, PageSize } from '@/types';

/**
 * Inject a dynamic `@page` rule so the browser prints on the selected paper
 * size and orientation. The style element is reused between renders.
 *
 * The margin of the page is a parameter: the joining form is printed with a
 * narrow margin, so the form fills the paper the way the paper form does.
 */
export function usePageSizeStyle(pageSize: PageSize, orientation: Orientation, marginMm = 12): void {
  useEffect(() => {
    const id = 'kores-page-size-rule';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${pageSize} ${orientation}; margin: ${marginMm}mm; }`;
  }, [pageSize, orientation, marginMm]);
}
