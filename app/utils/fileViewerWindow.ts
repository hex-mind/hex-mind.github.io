export const FILE_VIEWER_WINDOW_WIDTH = 840;
export const FILE_VIEWER_WINDOW_HEIGHT = 520;

export function fileViewerWindowChrome(pos: { x: number; y: number }) {
  return {
    closable: true,
    resizable: true,
    focusOnOpen: true,
    scroll: 'manual' as const,
    x: pos.x,
    y: pos.y,
    width: FILE_VIEWER_WINDOW_WIDTH,
    height: FILE_VIEWER_WINDOW_HEIGHT,
    expiry: Infinity,
  };
}
