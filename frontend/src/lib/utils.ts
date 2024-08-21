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
      let data = (await ClipboardGetText()) ?? "";
      if (data.includes("\n")) data = data.trim().replace("\n", "");

      if (data.includes("\r")) {
        multilineModal.value = `open:${data.split("\r").join("\n")}`;
        await until(multilineModal).changed();
        if (!(multilineModal.value === "accepted")) {
          return "";
        }
        multilineModal.value = "closed";
        return data.endsWith("\r") ? data : `${data}\r`;
      }
      return data;
    },
  });
}
