import { ClipboardAddon } from "@xterm/addon-clipboard";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { multilineModal } from "@/store";
import { ClipboardGetText, ClipboardSetText } from "@@/wailsjs/runtime/runtime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function waitDomUpdate() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function clipboardAddon() {
  return new ClipboardAddon({
    writeText: (_, text) => {
      return ClipboardSetText(text).then((_status) => {
        // TODO: telemetry
      });
    },
    readText: async () => {
      const text = (await ClipboardGetText()) ?? "";
      const lines = text.split(/\r?\n/);
      if (lines.length === 1) {
        return text;
      }
      multilineModal.value = lines;
      await until(multilineModal).toMatch((v) => typeof v === "boolean");
      if (!multilineModal.value) {
        return "";
      }
      multilineModal.value = false;
      return text;
    },
  });
}
