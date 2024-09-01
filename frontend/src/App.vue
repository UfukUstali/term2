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
  ctrlTabOpen,
} from "@/store";
import { VisuallyHidden } from "radix-vue";
import { triggerAction } from "@/config";

const multilineOpen = computed(() => typeof multilineModal.value === "object");

const termList = ref<HTMLElement | null>(null);

function handleCtrlTab(id: number) {
  currentTerminal.value = id;
  ctrlTabOpen.value = false;
}

const parentEl = ref<HTMLElement | null>(null);

const entry = computed(() => store.get(currentTerminal.value)!);

watch(ctrlTabOpen, async (val) => {
  if (!val) {
    await nextTick();
    store.get(currentTerminal.value)!.terminal.focus();
  }
});

watch(currentTerminal, (val) => {
  if (val !== -1) {
    store.get(val)!.terminal.focus();
  }
});

if (currentTerminal.value === -1) {
  triggerAction("newTerminal", -1);
  // .then((id) => console.log("Created terminal", id.id))
}
</script>

<template>
  <div ref="parentEl" class="h-screen w-screen overflow-hidden">
    <div
      :class="[
        'bg-image absolute left-0 top-0 h-screen w-full overflow-x-auto bg-black/80 p-1 bg-blend-multiply',
        id === currentTerminal ? 'z-10' : '',
      ]"
      :style="{ backgroundImage: `url(@term2${entry.backgroundUrl})` }"
      v-for="[id] in keys"
      :key="id"
    >
      <TermComp :id="id" :entry />
    </div>
    <AlertDialog :open="multilineOpen"
      ><AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Multiline command detected</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to run a multiline command. Do you want to continue?
            <pre
              v-for="(line, index) in multilineModal"
              :key="index"
              class="pt-2"
              >{{ line }}</pre
            >
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="multilineModal = false"
            >Cancel</AlertDialogCancel
          >
          <AlertDialogAction @click="multilineModal = true"
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
        @close-auto-focus="(e) => e.preventDefault()"
      >
        <VisuallyHidden>
          <AlertDialogTitle>Terminal Switcher</AlertDialogTitle>
        </VisuallyHidden>
        <button
          ref="termList"
          v-for="[id, entry] in store"
          :key="id"
          :class="[
            'inline-flex h-10 items-center justify-start gap-4 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
            id === currentTerminal ? 'ring-2 ring-white' : '',
          ]"
          @click="handleCtrlTab(id)"
        >
          <img class="size-6" :src="`@term2${entry.logoUrl}`" />
          <h1 class="text-2xl tracking-tight">{{ entry.title }}</h1>
        </button>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
