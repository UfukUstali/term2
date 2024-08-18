import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
// import { invoke, clipboard } from "@tauri-apps/api";
import { ClipboardGetText, EventsEmit, EventsOn } from "@@/wailsjs/runtime";
import { ConsoleLog, CreateTerminal } from "@@/wailsjs/go/main/App";

// import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { SerializeAddon } from "@xterm/addon-serialize";
import { clipboardAddon as ClipboardAddon } from "./lib/utils";
import { main } from "@@/wailsjs/go/models";
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
  config.args = ["-NoLogo"];
  // config.args = ["-NoLogo", "-NoProfile"];
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
    destroyTerminal(id, true).catch(console.error);
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
  return {
    id,
    terminal,
  };
}

export const multilineModal = ref("closed");

export async function writeTerminal(id: number, data: string) {
  const { pty } = store.get(id)!;
  if (data === "\u0016") {
    // Ctrl + V
    const text = await ClipboardGetText();
    if (!text) return; // TODO: show toast
    data = text;
  }
  if (data.includes("\n")) data = data.trim().replace("\n", "");
  if (data.includes("\r") && !(data.length === 1)) {
    multilineModal.value = `open:${data.split("\r").join("\n")}`;
    await until(multilineModal).changed();
    if (!(multilineModal.value === "accepted")) return;
    multilineModal.value = "closed";

    pty.write(data);
    return;
  }
  pty.write(data);
}

export async function destroyTerminal(id: number, fromExit = false) {
  const { terminal, pty } = store.get(id)!;
  const ids = Array.from(store.keys());
  if (store.size === 1) {
    await createTerminal();
  } else {
    currentTerminal.value = ids[0] === id ? ids[1] : ids[0];
  }
  terminal.dispose();

  if (!fromExit) pty.destroy();
  keys.value.delete(id);
  store.delete(id);
}

export async function resizeTerminal(id: number) {
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
