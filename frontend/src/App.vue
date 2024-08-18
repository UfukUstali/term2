<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TermComp from "@/components/TermComp.vue";
import {
  createTerminal,
  currentTerminal,
  store,
  keys,
  multilineModal,
  ctrlTabSelected,
} from "@/store";
import { VisuallyHidden } from "radix-vue";

function setMultilineModel(value: string) {
  multilineModal.value = value;
}

const multilineOpen = computed(() => multilineModal.value.startsWith("open:"));

const ctrlTabOpen = computed(() => ctrlTabSelected.value !== -1);

const termList = ref<HTMLElement | null>(null);

function handleCtrlTab(id: number) {
  currentTerminal.value = id;
  ctrlTabSelected.value = -1;
}

const parentEl = ref<HTMLElement | null>(null);

const scroll = useScroll(parentEl);

watch(currentTerminal, async (val) => {
  const index = Array.from(keys.value.keys()).indexOf(val);
  console.log("scrolling to", index);
  console.log("old", parentEl.value?.scrollTop);
  const newScrollTop = (parentEl.value?.clientHeight ?? 0) * Math.max(0, index);
  console.log("new", newScrollTop);
  scroll.y.value = -newScrollTop;
});

if (currentTerminal.value === -1) {
  // don't await
  createTerminal();
  // .then((id) => console.log("Created terminal", id.id))
}
</script>

<template>
  <div ref="parentEl" class="h-screen w-screen overflow-hidden bg-black/80">
    <div class="h-screen overflow-x-auto p-1" v-for="[id] in keys" :key="id">
      <TermComp :id="id" :terminal="store.get(id)!" :scroll="scroll" />
    </div>
    <AlertDialog :open="multilineOpen"
      ><AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Multiline command detected</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to run a multiline command. Do you want to continue?
            <pre class="pt-2">{{ multilineModal.substring(5) }}</pre>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="setMultilineModel('closed')"
            >Cancel</AlertDialogCancel
          >
          <AlertDialogAction @click="setMultilineModel('accepted')"
            >Continue</AlertDialogAction
          >
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialog
    >
    <AlertDialog :open="ctrlTabOpen">
      <AlertDialogContent
        :ui="{
          overlay: 'bg-transparent',
          content:
            'top-32 w-3/4 max-w-none border-slate-500 bg-white/5 backdrop-blur-3xl',
        }"
      >
        <VisuallyHidden>
          <AlertDialogTitle>Switch Terminal</AlertDialogTitle>
        </VisuallyHidden>
        <button
          ref="termList"
          v-for="([id, entry], index) in store"
          :key="id"
          :class="[
            'inline-flex h-10 items-center justify-start gap-4 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
            index === ctrlTabSelected ? 'ring-2 ring-white' : '',
          ]"
          @click="handleCtrlTab(id)"
        >
          <img class="size-6" :src="entry.logoUrl" />
          <h1 class="text-2xl tracking-tight">Powershell</h1>
        </button>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
