import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SerializeAddon } from "@xterm/addon-serialize";

import { ConsoleLog, CreateTerminal } from "@@/wailsjs/go/main/App";
import { main } from "@@/wailsjs/go/models";
import { clipboardAddon as ClipboardAddon } from "@/lib/utils";
import Pty from "@/pty";
import { handleEvent, Profile, triggerAction } from "@/config";

export type StoreEntry = {
  terminal: Terminal;
  pty: Pty;
  fitAddon: FitAddon;
  serializeAddon: SerializeAddon;
  mode: Ref<"normal" | "fullscreen">;
  title: string;
  logoUrl: string;
  backgroundUrl: string;
};

export const store = new Map<number, StoreEntry>();

export const keys = ref(new Map<number, boolean>());

export const currentTerminal = ref(-1);

export const multilineModal = ref<boolean | string[]>(false);

export const ctrlTabOpen = ref(false);

const CALLBACK_BYTE_LIMIT = 100000;
const HIGH = 5;
const LOW = 2;

export async function createTerminal(profile: Profile) {
  const terminal = new Terminal({
    fontFamily: profile.font,
    fontSize: profile.fontSize,
    theme: profile.theme,
    allowTransparency: true,
    cursorBlink: true,
  });
  const fitAddon = new FitAddon();
  const serializeAddon = new SerializeAddon();
  const clipboardAddon = ClipboardAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(serializeAddon);
  terminal.loadAddon(clipboardAddon);

  const config = new main.TerminalConfig();
  config.command = profile.command;
  config.args = profile.args;
  config.cwd = profile.cwd;

  const id = await CreateTerminal(config);

  terminal.attachCustomKeyEventHandler((event) => {
    return handleEvent(event, id);
  });

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
    title: profile.name,
    logoUrl: profile.logo,
    backgroundUrl: profile.backgroundImage,
  });
  keys.value.set(id, false);
  currentTerminal.value = id;
}

export function destroyTerminal(id: number, options?: { fromExit?: boolean }) {
  if (!store.has(id)) {
    console.error(`Terminal with id ${id} not found`);
    return;
  }

  const { fromExit = false } = options || {};
  const { terminal, pty } = store.get(id)!;

  if (keys.value.size === 1) {
    triggerAction("newTerminal", id);
  } else {
    triggerAction("previousTab", id);
    triggerAction("closeTabSwitcher", id);
  }
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
