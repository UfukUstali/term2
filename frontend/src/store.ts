import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";

import { ConsoleLog, CreateTerminal } from "@@/wailsjs/go/main/App";
import { main } from "@@/wailsjs/go/models";
import { clipboardAddon as ClipboardAddon } from "@/lib/utils";
import Pty from "@/pty";

export type StoreEntry = {
  terminal: Terminal;
  pty: Pty;
  fitAddon: FitAddon;
  serializeAddon: SerializeAddon;
  mode: Ref<"normal" | "fullscreen">;
  logoUrl: string;
  scrollPosition?: number;
};

export const store = new Map<number, StoreEntry>();

export const keys = ref(new Map<number, string>());

export const currentTerminal = ref(-1);

const CALLBACK_BYTE_LIMIT = 100000;
const HIGH = 5;
const LOW = 2;

export async function createTerminal() {
  const terminal = new Terminal({
    fontFamily: "CaskaydiaCove NF Mono Regular",
    fontSize: 18,
    theme: {
      background: "rgba(0, 0, 0, 0)",
      selectionBackground: "#FFFFFF99",
      selectionInactiveBackground: "#FFFFFF99",
    },
    allowTransparency: true,
    cursorBlink: true,
  });
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type === "keydown") {
      return keyDownHandler(event);
    } else if (event.type === "keyup") {
      return keyUpHandler(event);
    }
    return true;
  });
  const fitAddon = new FitAddon();
  const serializeAddon = new SerializeAddon();
  const clipboardAddon = ClipboardAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(serializeAddon);
  terminal.loadAddon(clipboardAddon);

  const config = new main.TerminalConfig();
  config.command = "powershell.exe";
  // config.args = ["-NoLogo"];
  config.args = ["-NoLogo", "-NoProfile"];
  config.cwd = import.meta.env.DEV ? "C:\\uni\\serbest\\term2" : undefined;
  const id = await CreateTerminal(config);
  const pty = await Pty.create(id);

  let written = 0;
  let pendingCallbacks = 0;

  pty.onData = (chunk) => {
    written += chunk.length;
    if (written > CALLBACK_BYTE_LIMIT) {
      terminal.write(chunk, () => {
        pendingCallbacks = Math.max(pendingCallbacks - 1, 0);
        if (pendingCallbacks < LOW) {
          pty.resume();
        }
      });
      pendingCallbacks++;
      written = 0;
      if (pendingCallbacks > HIGH) {
        pty.pause();
      }
    } else {
      terminal.write(chunk); // fast path for most chunks if chunk.length << CALLBACK_BYTE_LIMIT
    }
  };

  pty.onClose = () => {
    destroyTerminal(id, {
      fromExit: true,
    });
  };

  store.set(id, {
    terminal,
    pty,
    fitAddon,
    serializeAddon,
    mode: ref("normal"),
    logoUrl: "/powershell_icon.svg",
  });
  keys.value.set(id, "");
  currentTerminal.value = id;
}

export const multilineModal = ref("closed");

export function destroyTerminal(id: number, options?: { fromExit?: boolean }) {
  if (!store.has(id)) {
    console.error(`Terminal with id ${id} not found`);
    return;
  }

  const { fromExit = false } = options || {};
  const { terminal, pty } = store.get(id)!;

  if (!fromExit) pty.destroy();
  keys.value.delete(id);
  terminal.dispose();
  store.delete(id);
}

export function resizeTerminal(id: number) {
  const { fitAddon, terminal, pty } = store.get(id)!;
  fitAddon.fit();
  pty.resize(terminal.rows, terminal.cols);
}

export const ctrlTabSelected = ref(-1);

// let xterm only know that it should not handle these keys
function keyDownHandler(event: KeyboardEvent): boolean {
  switch (event.code) {
    case "F5":
      return false;

    case "KeyF":
      if (event.altKey) {
        return false;
      }
    // fallthrough
    case "KeyR":
    case "KeyN":
    case "KeyW":
    case "Tab":
      if (event.ctrlKey || event.metaKey) {
        return false;
      }
      return true;

    case "KeyQ":
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        return false;
      }
      return true;

    default:
      return true;
  }
}

function keyUpHandler(event: KeyboardEvent): boolean {
  switch (event.code) {
    case "ControlLeft":
      if (event.ctrlKey || event.metaKey) {
        return false;
      }
      return true;

    default:
      return true;
  }
}
