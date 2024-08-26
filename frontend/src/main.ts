import { createApp } from "vue";
import App from "./App.vue";
import "@xterm/xterm/css/xterm.css";
import "@/assets/index.css";
import { currentTerminal } from "@/store";
import { handleEvent } from "@/keyboard";

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
  if (import.meta.env.PROD) {
    event.preventDefault();
  }
});

document.addEventListener("keydown", (event) => {
  handleEvent(event, currentTerminal.value);
});

document.addEventListener("keyup", (event) => {
  handleEvent(event, currentTerminal.value);
});
