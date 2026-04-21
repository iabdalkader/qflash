export interface MenuAction {
  label: string;
  danger?: boolean;
  handler: () => void;
}

let activeMenu: HTMLElement | null = null;

function dismiss() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  document.removeEventListener("mousedown", onOutsideClick);
  document.removeEventListener("keydown", onEscape);
}

function onOutsideClick(e: MouseEvent) {
  if (activeMenu && !activeMenu.contains(e.target as Node)) {
    dismiss();
  }
}

function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape") {
    dismiss();
  }
}

export function showContextMenu(x: number, y: number, actions: MenuAction[]) {
  dismiss();

  const menu = document.createElement("div");
  menu.className = "context-menu";

  for (const action of actions) {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    if (action.danger) {
      item.classList.add("context-menu-item--danger");
    }
    item.textContent = action.label;
    item.addEventListener("click", () => {
      dismiss();
      action.handler();
    });
    menu.appendChild(item);
  }

  // Position, clamped to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  menu.style.left = `${Math.min(x, vw - 180)}px`;
  menu.style.top = `${Math.min(y, vh - actions.length * 32 - 16)}px`;

  document.body.appendChild(menu);
  activeMenu = menu;

  // Defer listener attachment so the triggering click doesn't dismiss immediately
  requestAnimationFrame(() => {
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  });
}

export function hideContextMenu() {
  dismiss();
}
