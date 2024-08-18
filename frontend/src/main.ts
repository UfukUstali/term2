import { createApp } from "vue";
import App from "./App.vue";
import "@xterm/xterm/css/xterm.css";
import "@/assets/index.css";
import {
  store,
  currentTerminal,
  ctrlTabSelected,
  createTerminal,
  destroyTerminal,
} from "@/store";
import { ClipboardSetText } from "@@/wailsjs/runtime/runtime";

createApp(App).mount("#app");

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
        if (store.size < 2) return false;
        if (ctrlTabSelected.value === -1) {
          const keys = Array.from(store.keys());
          const currentIndex = keys.indexOf(currentTerminal.value);
          ctrlTabSelected.value =
            (event.shiftKey ?
              currentIndex - 1 + store.size
            : currentIndex + 1) % keys.length;
        } else {
          ctrlTabSelected.value =
            (event.shiftKey ?
              ctrlTabSelected.value - 1 + store.size
            : ctrlTabSelected.value + 1) % store.size;
        }
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

    default:
      return true;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "ControlLeft":
      if (ctrlTabSelected.value !== -1) {
        const keys = Array.from(store.keys());
        currentTerminal.value = keys[ctrlTabSelected.value];
        ctrlTabSelected.value = -1;
        return false;
      }
      return true;

    default:
      return true;
  }
});
