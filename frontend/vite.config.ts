import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// @ts-ignore
import path from "node:path";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import unimport from "unimport/unplugin";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  esbuild: {
    target: ["esnext"],
  },
  plugins: [
    vue(),
    unimport.vite({
      presets: ["vue", "@vueuse/core"],
      dts: "./src/auto-imports.d.ts",
    }),
  ],
  resolve: {
    alias: {
      // @ts-ignore
      "@": path.resolve(__dirname, "./src"),
      // @ts-ignore
      "@@": path.resolve(__dirname, "./"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()],
    },
  },
}));
