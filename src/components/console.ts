import { listen } from "@tauri-apps/api/event";

export interface ConsoleController {
  element: HTMLElement;
  log(message: string): void;
  clear(): void;
}

export function createConsole(): ConsoleController {
  const el = document.createElement("div");
  el.className = "console-panel";

  // Resize handle with clear button
  const handle = document.createElement("div");
  handle.className = "console-resize-handle";
  const clearBtn = document.createElement("button");
  clearBtn.className = "console-clear-btn";
  clearBtn.title = "Clear";
  clearBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="12" height="12">
    <path d="M2 4h12M5.5 4V2.5h5V4M6 7v4M10 7v4M3.5 4l.5 9.5h8l.5-9.5"/>
  </svg>`;
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    output.innerHTML = "";
  });
  handle.appendChild(clearBtn);
  el.appendChild(handle);

  const output = document.createElement("div");
  output.className = "console-output";
  el.appendChild(output);

  // Drag to resize
  let startY = 0;
  let startH = 0;
  handle.addEventListener("mousedown", (e) => {
    startY = e.clientY;
    startH = el.offsetHeight;
    const onMove = (e: MouseEvent) => {
      const h = Math.max(40, startH - (e.clientY - startY));
      el.style.flexBasis = h + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  listen<string>("console-log", (event) => {
    appendLine(event.payload);
  });

  function appendLine(text: string) {
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  return {
    element: el,
    log(message) {
      appendLine(message);
    },
    clear() {
      output.innerHTML = "";
    },
  };
}
