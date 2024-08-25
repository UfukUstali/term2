import { createApp } from "vue";
import App from "./App.vue";
import "@xterm/xterm/css/xterm.css";
import "@/assets/index.css";
import {
  store,
  currentTerminal,
  ctrlTabOpen as ctrlTabOpen,
  createTerminal,
  destroyTerminal,
  keys,
} from "@/store";
import { ClipboardGetText, ClipboardSetText } from "@@/wailsjs/runtime/runtime";
// import { ConsoleLog, GetIds } from "@@/wailsjs/go/main/App";
// import Pty from "./pty";

createApp(App).mount("#app");

if (import.meta.hot) {
  console.log("HMR enabled");
  const hot = import.meta.hot;
  hot.on("vite:beforeUpdate", (payload) => {
    const update = payload.updates.some(
      (update) => update.type === "js-update",
    );
    console.log("HMR update", update);
    if (update) {
      window.location.reload();
    }
  });
}

document.addEventListener("contextmenu", (event) => {
  // event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "F5":
      event.preventDefault();
      event.stopPropagation();
      return false;

    case "KeyF":
      if (event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        const mode = store.get(currentTerminal.value)!.mode;
        store.get(currentTerminal.value)!.mode.value =
          mode.value === "normal" ? "fullscreen" : "normal";
        return false;
      }
    // fallthrough
    case "KeyR":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      return true;

    case "Tab":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (keys.value.size < 2) return false;
        ctrlTabOpen.value = true;
        const ids = Array.from(keys.value.keys());
        const currentIndex = ids.indexOf(currentTerminal.value);
        currentTerminal.value =
          ids[
            (event.shiftKey ?
              currentIndex - 1 + store.size
            : currentIndex + 1) % ids.length
          ];
        return false;
      }
      return true;

    case "KeyQ":
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        const term = store.get(currentTerminal.value)!;
        const html = term.serializeAddon.serializeAsHTML({
          onlySelection: true,
        });
        ClipboardSetText(html);
        // .then(() => console.log("Copied to clipboard"));
        return false;
      }
      return true;

    case "KeyN":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        createTerminal();
        // .then(() => console.log("New terminal created"));
        return false;
      }
      return true;

    case "KeyW":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        destroyTerminal(currentTerminal.value);
        // .then(() => console.log("Terminal closed"),);
        return false;
      }
      return true;

    case "KeyC":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const term = store.get(currentTerminal.value)!;
        const selection = term.terminal.getSelection();
        ClipboardSetText(selection);
        // .then(() => console.log("Copied to clipboard"));
        return false;
      }
      return true;

    case "KeyV":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const term = store.get(currentTerminal.value)!;
        // const selection = term.terminal.getSelectionPosition(); // MAYBE
        ClipboardGetText().then((text) => {
          if (text) {
            term.terminal.paste(text);
          }
        });
        return false;
      }
      return true;

    case "KeyX":

    default:
      return true;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "ControlLeft":
      if (ctrlTabOpen.value) {
        ctrlTabOpen.value = false;

        return false;
      }
      return true;

    default:
      return true;
  }
});
