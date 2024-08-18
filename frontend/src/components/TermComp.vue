<script lang="ts" setup>
import {
  resizeTerminal,
  writeTerminal,
  StoreEntry,
  currentTerminal,
} from "@/store";
import { IDisposable } from "@xterm/xterm";

const props = defineProps<{
  id: number;
  terminal: StoreEntry;
  scroll: ReturnType<typeof useScroll>;
}>();

const termEl = ref<HTMLElement | undefined>();
const termElParent = computed(() => termEl.value?.parentElement);
const termObserver = useElementSize(termEl);
const parentObserver = useElementSize(termElParent);
// const scroll = useScroll(termElParent);

const scrollableWidth = computed(() => {
  if (!termElParent.value) return 0;
  return termElParent.value.scrollWidth - parentObserver.width.value;
});

const maxScroll = ref(0);

const isFullscreen = computed(() => props.terminal.mode.value === "fullscreen");

onMounted(async () => {
  props.terminal.terminal.onData(async (data) => {
    if (!props.terminal) {
      console.error("Terminal not initialized");
      return;
    }
    await writeTerminal(props.id, data);
  });
  props.terminal.terminal.open(termEl.value!);
  // don't know why but we need to resize twice initially with timeout to get the correct behavior
  await props.terminal.pty.openPromise;
  if (props.id === 0 || import.meta.env.DEV) {
    termEl.value!.style.width = "50px";
    await new Promise((resolve) => setTimeout(resolve, 150));
    props.terminal.fitAddon.fit();
    termEl.value!.removeAttribute("style");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await resizeTerminal(props.id);
});

let unwatch: (() => void) | undefined;

onActivated(async () => {
  const unwatch1 = watchDebounced(
    [parentObserver.height, termObserver.width],
    async (val) => {
      if (val[0] === 0 || val[1] === 0) return;
      // console.log("resize", val);
      await resizeTerminal(props.id);
    },
    { immediate: true },
  );

  let disposable: IDisposable | undefined;
  let unwatch2: (() => void) | undefined;

  const unwatch3 = watch(
    isFullscreen,
    (val) => {
      if (!val) {
        const left = termEl.value!.clientLeft;
        const rows = termEl.value!.getElementsByClassName(
          "xterm-rows",
        )[0] as HTMLElement;
        if (!rows) {
          console.log("no xterm-rows");
          return;
        }
        disposable = props.terminal.terminal.onRender(({ start, end }) => {
          // console.log("start", start, "end", end);
          for (let i = 0; i < rows.children.length; i++) {
            if (i < start || i > end) continue;
            const lastChild = rows.children[i].lastElementChild;
            if (!lastChild) continue;
            const right = lastChild.getBoundingClientRect().right;
            // console.log("left", left, "right", right);
            const contentWidth =
              right - left - parentObserver.width.value + props.scroll.x.value;
            // console.log("row", i, "scrollWidth", contentWidth);
            if (!(contentWidth >= 9900 - parentObserver.width.value))
              maxScroll.value = Math.max(maxScroll.value, contentWidth);
          }
        });

        unwatch2 = watch(
          props.scroll.x,
          (val) => {
            // console.log("scroll", val, "maxScroll", maxScroll.value);
            if (val > maxScroll.value) {
              props.scroll.x.value = maxScroll.value;
            }
          },
          { immediate: true },
        );
      } else {
        if (disposable) {
          unwatch2 && unwatch2();
          unwatch2 = undefined;
          disposable.dispose();
          disposable = undefined;
        }
        props.terminal.scrollPosition = undefined;
      }
    },
    { immediate: true },
  );

  unwatch = () => {
    unwatch1();
    unwatch2 && unwatch2();
    unwatch2 = undefined;
    unwatch3();
    if (disposable) {
      disposable.dispose();
      disposable = undefined;
    }
  };
  if (!isFullscreen.value)
    props.scroll.x.value = props.terminal.scrollPosition || 0;
  // await resizeTerminal(props.id);
  props.terminal.terminal.focus();
});

onDeactivated(() => {
  if (unwatch) {
    unwatch();
    unwatch = undefined;
  }
  if (!isFullscreen.value) props.terminal.scrollPosition = props.scroll.x.value;
});
</script>

<template>
  <div
    :class="[
      'h-full bg-transparent',
      isFullscreen ? 'w-full' : 'TODO:change_later w-[10000px]',
    ]"
    ref="termEl"
  />
</template>
