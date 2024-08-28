import { z } from "zod";
import {
  createTerminal,
  ctrlTabOpen,
  currentTerminal,
  destroyTerminal,
  keys,
  multilineModal,
  store,
} from "@/store";
import { ClipboardGetText, ClipboardSetText } from "@@/wailsjs/runtime/runtime";
import { ReadConfigFile } from "@@/wailsjs/go/main/App";

const scopes = new Map<
  string,
  Map<
    number,
    | string
    | {
        action: string;
        setScope: string;
      }
  >
>();

let shortcuts = new Map<
  number,
  | string
  | {
      action: string;
      setScope: string;
    }
>();

const actions = new Map<
  string,
  (e: KeyboardEvent | undefined, id: number) => boolean
>([
  [
    "newTerminal",
    () => {
      createTerminal();
      return false;
    },
  ],
  [
    "closeTerminal",
    (_, id) => {
      destroyTerminal(id);
      return false;
    },
  ],
  [
    "nextTab",
    (_, id) => {
      if (keys.value.size < 2) return false;
      ctrlTabOpen.value = true;
      const ids = Array.from(keys.value.keys());
      const currentIndex = ids.indexOf(id);
      currentTerminal.value = ids[(currentIndex + 1) % ids.length];
      return false;
    },
  ],
  [
    "previousTab",
    (_, id) => {
      if (keys.value.size < 2) return false;
      ctrlTabOpen.value = true;
      const ids = Array.from(keys.value.keys());
      const currentIndex = ids.indexOf(id);
      currentTerminal.value = ids[(currentIndex - 1 + ids.length) % ids.length];
      return false;
    },
  ],
  [
    "closeTabSwitcher",
    () => {
      ctrlTabOpen.value = false;
      return false;
    },
  ],
  [
    "toggleTerminalMode",
    (_, id) => {
      const mode = store.get(id)!.mode;
      mode.value = mode.value === "normal" ? "fullscreen" : "normal";
      return false;
    },
  ],
  [
    "copy",
    (e, id) => {
      const term = store.get(id)!;
      let selection: string | null = null;
      if (e && e.currentTarget === document) {
        const browserSelection = window.getSelection();
        if (
          !browserSelection ||
          browserSelection.type.toLowerCase() !== "range"
        )
          return true;
        selection = browserSelection.toString();
      } else {
        selection = term.terminal.getSelection();
      }
      ClipboardSetText(selection).catch(console.error);
      return false;
    },
  ],
  [
    "paste",
    (_, id) => {
      const term = store.get(id)!;
      // TODO: paste to cursor position overriding selection if present and if in a writable area(prompt) (possible after integration scripts)
      ClipboardGetText()
        .then(async (text) => {
          const lines = text.split(/\r?\n/);
          if (lines.length === 1) {
            term.terminal.paste(text);
            return;
          }
          multilineModal.value = lines;
          await until(multilineModal).toMatch((v) => typeof v === "boolean");
          if (multilineModal.value) {
            term.terminal.paste(text);
          }
          multilineModal.value = false;
        })
        .catch(console.error);
      return false;
    },
  ],
]);

export type KeyEvent = {
  code: string;
  type?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

const KeyUp = 2048; // 1 << 11

const enum Modifier {
  Shift = (1 << 10) >>> 0,
  Alt = (1 << 9) >>> 0,
  Control = (1 << 8) >>> 0,
}

const enum Code {
  None,
  KeyA,
  KeyB,
  KeyC,
  KeyD,
  KeyE,
  KeyF,
  KeyG,
  KeyH,
  KeyI,
  KeyJ,
  KeyK,
  KeyL,
  KeyM,
  KeyN,
  KeyO,
  KeyP,
  KeyQ,
  KeyR,
  KeyS,
  KeyT,
  KeyU,
  KeyV,
  KeyW,
  KeyX,
  KeyY,
  KeyZ,
  Digit1,
  Digit2,
  Digit3,
  Digit4,
  Digit5,
  Digit6,
  Digit7,
  Digit8,
  Digit9,
  Digit0,
  Enter,
  Escape,
  Backspace,
  Tab,
  Space,
  Minus,
  Equal,
  BracketLeft,
  BracketRight,
  Backslash,
  Semicolon,
  Quote,
  Backquote,
  Comma,
  Period,
  Slash,
  CapsLock,
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,
  PrintScreen,
  ScrollLock,
  Pause,
  Insert,
  Home,
  PageUp,
  Delete,
  End,
  PageDown,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  NumLock,
  NumpadDivide,
  NumpadMultiply,
  NumpadSubtract,
  NumpadAdd,
  NumpadEnter,
  Numpad1,
  Numpad2,
  Numpad3,
  Numpad4,
  Numpad5,
  Numpad6,
  Numpad7,
  Numpad8,
  Numpad9,
  Numpad0,
  NumpadDecimal,
  Control,
  Shift,
  Alt,

  MAX_VALUE,
}

const codeToNumber = new Map<string, Code>([
  ["KeyA", Code.KeyA],
  ["KeyB", Code.KeyB],
  ["KeyC", Code.KeyC],
  ["KeyD", Code.KeyD],
  ["KeyE", Code.KeyE],
  ["KeyF", Code.KeyF],
  ["KeyG", Code.KeyG],
  ["KeyH", Code.KeyH],
  ["KeyI", Code.KeyI],
  ["KeyJ", Code.KeyJ],
  ["KeyK", Code.KeyK],
  ["KeyL", Code.KeyL],
  ["KeyM", Code.KeyM],
  ["KeyN", Code.KeyN],
  ["KeyO", Code.KeyO],
  ["KeyP", Code.KeyP],
  ["KeyQ", Code.KeyQ],
  ["KeyR", Code.KeyR],
  ["KeyS", Code.KeyS],
  ["KeyT", Code.KeyT],
  ["KeyU", Code.KeyU],
  ["KeyV", Code.KeyV],
  ["KeyW", Code.KeyW],
  ["KeyX", Code.KeyX],
  ["KeyY", Code.KeyY],
  ["KeyZ", Code.KeyZ],
  ["Digit1", Code.Digit1],
  ["Digit2", Code.Digit2],
  ["Digit3", Code.Digit3],
  ["Digit4", Code.Digit4],
  ["Digit5", Code.Digit5],
  ["Digit6", Code.Digit6],
  ["Digit7", Code.Digit7],
  ["Digit8", Code.Digit8],
  ["Digit9", Code.Digit9],
  ["Digit0", Code.Digit0],
  ["Enter", Code.Enter],
  ["Escape", Code.Escape],
  ["Backspace", Code.Backspace],
  ["Tab", Code.Tab],
  ["Space", Code.Space],
  ["Minus", Code.Minus],
  ["Equal", Code.Equal],
  ["BracketLeft", Code.BracketLeft],
  ["BracketRight", Code.BracketRight],
  ["Backslash", Code.Backslash],
  ["Semicolon", Code.Semicolon],
  ["Quote", Code.Quote],
  ["Backquote", Code.Backquote],
  ["Comma", Code.Comma],
  ["Period", Code.Period],
  ["Slash", Code.Slash],
  ["CapsLock", Code.CapsLock],
  ["F1", Code.F1],
  ["F2", Code.F2],
  ["F3", Code.F3],
  ["F4", Code.F4],
  ["F5", Code.F5],
  ["F6", Code.F6],
  ["F7", Code.F7],
  ["F8", Code.F8],
  ["F9", Code.F9],
  ["F10", Code.F10],
  ["F11", Code.F11],
  ["F12", Code.F12],
  ["PrintScreen", Code.PrintScreen],
  ["ScrollLock", Code.ScrollLock],
  ["Pause", Code.Pause],
  ["Insert", Code.Insert],
  ["Home", Code.Home],
  ["PageUp", Code.PageUp],
  ["Delete", Code.Delete],
  ["End", Code.End],
  ["PageDown", Code.PageDown],
  ["ArrowRight", Code.ArrowRight],
  ["ArrowLeft", Code.ArrowLeft],
  ["ArrowDown", Code.ArrowDown],
  ["ArrowUp", Code.ArrowUp],
  ["NumLock", Code.NumLock],
  ["NumpadDivide", Code.NumpadDivide],
  ["NumpadMultiply", Code.NumpadMultiply],
  ["NumpadSubtract", Code.NumpadSubtract],
  ["NumpadAdd", Code.NumpadAdd],
  ["NumpadEnter", Code.NumpadEnter],
  ["Numpad1", Code.Numpad1],
  ["Numpad2", Code.Numpad2],
  ["Numpad3", Code.Numpad3],
  ["Numpad4", Code.Numpad4],
  ["Numpad5", Code.Numpad5],
  ["Numpad6", Code.Numpad6],
  ["Numpad7", Code.Numpad7],
  ["Numpad8", Code.Numpad8],
  ["Numpad9", Code.Numpad9],
  ["Numpad0", Code.Numpad0],
  ["NumpadDecimal", Code.NumpadDecimal],
  ["Control", Code.Control],
  ["ControlLeft", Code.Control],
  ["ControlRight", Code.Control],
  ["Shift", Code.Shift],
  ["ShiftLeft", Code.Shift],
  ["ShiftRight", Code.Shift],
  ["Alt", Code.Alt],
  ["AltLeft", Code.Alt],
  ["AltRight", Code.Alt],
]);

function eventToShortcut(e: KeyEvent): number {
  const code = codeToNumber.get(e.code) ?? Code.None;
  if (code === Code.None || code >= Code.MAX_VALUE) {
    return Code.None;
  }
  if (code === Code.Control || code === Code.Shift || code === Code.Alt) {
    return code;
  }

  let result = code;
  if (e.ctrlKey) result |= Modifier.Control;
  if (e.shiftKey) result |= Modifier.Shift;
  if (e.altKey) result |= Modifier.Alt;
  if (e.type === "keyup") result |= KeyUp;
  return result;
}

export function handleEvent(e: KeyboardEvent | KeyEvent, id: number): boolean {
  if (e.type === "keypress") {
    return true;
  }

  const key = eventToShortcut(
    "preventDefault" in e ?
      {
        code: e.code,
        type: e.type,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      }
    : e,
  );
  if (key === Code.None) {
    return true;
  }

  const event = "preventDefault" in e ? e : undefined;

  const entry = shortcuts.get(key);
  let temp: boolean | undefined;
  switch (typeof entry) {
    case "string":
      temp = actions.get(entry)!(event, id);
      break;
    case "object":
      temp = actions.get(entry.action)!(event, id);
      shortcuts = scopes.get(entry.setScope) ?? shortcuts;
      break;
    case "undefined":
      return true;
    default:
      console.error(`Invalid entry of type ${typeof entry}`);
      return true;
  }

  if (!temp && "preventDefault" in e) {
    e.preventDefault();
    e.stopPropagation();
  }

  return temp;
}

export function triggerAction(actionKey: string, id: number) {
  const action = actions.get(actionKey);
  if (!action) {
    console.error(`Invalid action ${actionKey}`);
    return true;
  }
  return action(undefined, id);
}

async function loadShortcuts() {
  const fileSchema = z.array(
    z.object({
      shortcut: z.object({
        code: z
          .string({
            message: "code: not a string",
          })
          .refine((value) => codeToNumber.has(value), {
            message: "code: invalid",
          }),
        type: z
          .enum(["keydown", "keyup"], {
            message: "type: invalid",
          })
          .optional()
          .default("keydown"),
        ctrlKey: z
          .boolean({ message: "ctrlKey: not a boolean" })
          .optional()
          .default(false),
        shiftKey: z
          .boolean({
            message: "shiftKey: not a boolean",
          })
          .optional()
          .default(false),
        altKey: z
          .boolean({
            message: "altKey: not a boolean",
          })
          .optional()
          .default(false),
      }),
      action: z
        .string({
          message: "action: not a string",
        })
        .refine((value) => actions.has(value), {
          message: "action: invalid",
        }),
      scopes: z
        .array(
          z.string({
            message: "scopes: not a string",
          }),
          {
            message: "scopes: not an array",
          },
        )
        .optional()
        .default(["default"]),
      setScope: z
        .string({
          message: "setScope: not a string",
        })
        .optional(),
    }),
  );

  const file = await ReadConfigFile();
  const data = fileSchema.safeParse(JSON.parse(file));
  if (!data.success) {
    data.error.issues.forEach((i) => console.error(i.message));
    return;
  }

  for (const { shortcut, action, scopes: _scopes, setScope } of data.data) {
    const key = eventToShortcut(shortcut);
    if (key === Code.None) {
      continue;
    }

    _scopes.forEach((scope) => {
      if (!scopes.has(scope)) {
        scopes.set(scope, new Map());
      }
      scopes.get(scope)!.set(
        key,
        setScope ?
          {
            action,
            setScope,
          }
        : action,
      );
    });
  }

  shortcuts =
    scopes.get("default") ??
    (scopes.size > 0 ? scopes.values().next().value : new Map());
}

loadShortcuts().then(() => {
  console.log("Shortcuts loaded");
});
