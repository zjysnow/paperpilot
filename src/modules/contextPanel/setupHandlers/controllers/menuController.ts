export const MODEL_MENU_OPEN_CLASS = "paperpilot-model-menu-open";
export const REASONING_MENU_OPEN_CLASS = "paperpilot-reasoning-menu-open";
export const RETRY_MODEL_MENU_OPEN_CLASS = "paperpilot-model-menu-open";
export const SLASH_MENU_OPEN_CLASS = "paperpilot-slash-menu-open";

export function setFloatingMenuOpen(
  menu: HTMLDivElement | null,
  openClass: string,
  isOpen: boolean,
): void {
  if (!menu) return;
  if (isOpen) {
    menu.style.display = "grid";
    menu.classList.add(openClass);
    return;
  }
  menu.classList.remove(openClass);
  menu.style.display = "none";
}

export function isFloatingMenuOpen(menu: HTMLDivElement | null): boolean {
  return Boolean(menu && menu.style.display !== "none");
}

export function positionFloatingMenu(
  owner: Element,
  menu: HTMLDivElement,
  anchor: HTMLButtonElement,
  preferAbove = false,
): void {
  const win = owner.ownerDocument?.defaultView;
  if (!win) return;

  const viewportMargin = 8;
  const gap = 6;
  const boundaryLeft = viewportMargin;
  const boundaryTop = viewportMargin;
  const boundaryRight = win.innerWidth - viewportMargin;
  const boundaryBottom = win.innerHeight - viewportMargin;
  const availableWidth = Math.max(120, boundaryRight - boundaryLeft);
  const availableHeight = Math.max(120, boundaryBottom - boundaryTop);

  menu.style.position = "fixed";
  menu.style.display = "grid";
  menu.style.visibility = "hidden";
  menu.style.width = `${Math.min(360, availableWidth)}px`;
  menu.style.maxWidth = `${availableWidth}px`;
  menu.style.maxHeight = `${availableHeight}px`;
  const fontScale = Number.parseFloat(
    win?.getComputedStyle(menu)?.getPropertyValue("--paperpilot-font-scale") ||
      "",
  );
  const minimumMenuHeight = Math.min(
    availableHeight,
    60 * (Number.isFinite(fontScale) ? fontScale : 1),
  );
  menu.style.minHeight = `${minimumMenuHeight}px`;
  menu.style.boxSizing = "border-box";
  menu.style.overflowY = "auto";
  menu.style.overflowX = "hidden";

  const anchorRect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const menuHeight = Math.min(
    Math.max(menu.scrollHeight, menuRect.height, minimumMenuHeight),
    availableHeight,
  );
  menu.style.height = `${menuHeight}px`;

  let left = anchorRect.left;
  const maxLeft = Math.max(boundaryLeft, boundaryRight - menuRect.width);
  left = Math.min(Math.max(boundaryLeft, left), maxLeft);

  const belowTop = anchorRect.bottom + gap;
  const aboveTop = anchorRect.top - gap - menuHeight;
  let top = preferAbove && aboveTop >= boundaryTop ? aboveTop : belowTop;

  if (!preferAbove && belowTop + menuHeight > boundaryBottom) {
    if (aboveTop >= boundaryTop) {
      top = aboveTop;
    } else {
      top = Math.max(boundaryTop, boundaryBottom - menuHeight);
    }
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(boundaryTop, top))}px`;
  menu.style.visibility = "visible";
}
