<script lang="ts" setup>
import { resizeTerminal, StoreEntry } from "@/store";

const props = defineProps<{
  id: number;
  entry: StoreEntry;
}>();

const termEl = ref<HTMLElement | undefined>();
const termElParent = computed(() => termEl.value?.parentElement);
const termObserver = useElementSize(termEl);
const parentObserver = useElementSize(termElParent);

const isFullscreen = computed(() => props.entry.mode.value === "fullscreen");

onMounted(async () => {
  props.entry.terminal.onData((s) => {
    if (s === "\x16") {
      triggerAction("paste", props.id);
      return;
    }
    props.entry.pty.write(s);
  });
  props.entry.terminal.onBinary((s) => {
    props.entry.pty.write(s);
  });
  props.entry.terminal.open(termEl.value!);
  await props.entry.pty.openPromise;
  // don't know why but we need to resize twice initially with timeout to get the correct behavior
  if (props.id === 0 || import.meta.env.DEV) {
    termEl.value!.style.width = "50px";
    await new Promise((resolve) => setTimeout(resolve, 150));
    props.entry.fitAddon.fit();
    termEl.value!.removeAttribute("style");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  resizeTerminal(props.id);
  props.entry.terminal.focus();

  watchDebounced(
    [parentObserver.height, termObserver.width],
    (val) => {
      if (val[0] === 0 || val[1] === 0) return;
      resizeTerminal(props.id);
    },
    { immediate: false },
  );
});
</script>

<template>
  <div
    :class="['h-full bg-transparent', isFullscreen ? 'w-full' : 'w-[10000px]']"
    ref="termEl"
  />
</template>
