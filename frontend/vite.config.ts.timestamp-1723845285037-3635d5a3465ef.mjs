// vite.config.ts
import { defineConfig } from "file:///C:/uni/serbest/term2/frontend/node_modules/.pnpm/vite@5.4.0/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/uni/serbest/term2/frontend/node_modules/.pnpm/@vitejs+plugin-vue@5.1.2_vite@5.4.0_vue@3.4.36_typescript@5.5.4_/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import path from "node:path";
import tailwind from "file:///C:/uni/serbest/term2/frontend/node_modules/.pnpm/tailwindcss@3.4.8/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///C:/uni/serbest/term2/frontend/node_modules/.pnpm/autoprefixer@10.4.20_postcss@8.4.41/node_modules/autoprefixer/lib/autoprefixer.js";
import unimport from "file:///C:/uni/serbest/term2/frontend/node_modules/.pnpm/unimport@3.10.0_rollup@4.20.0/node_modules/unimport/dist/unplugin.mjs";
var __vite_injected_original_dirname = "C:\\uni\\serbest\\term2\\frontend";
var vite_config_default = defineConfig(async () => ({
  plugins: [
    vue(),
    unimport.vite({
      presets: ["vue", "@vueuse/core"],
      dts: "./src/auto-imports.d.ts"
    })
  ],
  resolve: {
    alias: {
      // @ts-ignore
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      // @ts-ignore
      "@@": path.resolve(__vite_injected_original_dirname, "./")
    }
  },
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()]
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFx1bmlcXFxcc2VyYmVzdFxcXFx0ZXJtMlxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcdW5pXFxcXHNlcmJlc3RcXFxcdGVybTJcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L3VuaS9zZXJiZXN0L3Rlcm0yL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCB2dWUgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXZ1ZVwiO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHRhaWx3aW5kIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xuaW1wb3J0IGF1dG9wcmVmaXhlciBmcm9tIFwiYXV0b3ByZWZpeGVyXCI7XG5pbXBvcnQgdW5pbXBvcnQgZnJvbSBcInVuaW1wb3J0L3VucGx1Z2luXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoYXN5bmMgKCkgPT4gKHtcbiAgcGx1Z2luczogW1xuICAgIHZ1ZSgpLFxuICAgIHVuaW1wb3J0LnZpdGUoe1xuICAgICAgcHJlc2V0czogW1widnVlXCIsIFwiQHZ1ZXVzZS9jb3JlXCJdLFxuICAgICAgZHRzOiBcIi4vc3JjL2F1dG8taW1wb3J0cy5kLnRzXCIsXG4gICAgfSlcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIFwiQEBcIiA6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9cIiksXG4gICAgfSxcbiAgfSxcbiAgY3NzOiB7XG4gICAgcG9zdGNzczoge1xuICAgICAgcGx1Z2luczogW3RhaWx3aW5kKCksIGF1dG9wcmVmaXhlcigpXSxcbiAgICB9LFxuICB9LFxufSkpXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1SLFNBQVMsb0JBQW9CO0FBQ2hULE9BQU8sU0FBUztBQUVoQixPQUFPLFVBQVU7QUFDakIsT0FBTyxjQUFjO0FBQ3JCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sY0FBYztBQU5yQixJQUFNLG1DQUFtQztBQVN6QyxJQUFPLHNCQUFRLGFBQWEsYUFBYTtBQUFBLEVBQ3ZDLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxJQUNKLFNBQVMsS0FBSztBQUFBLE1BQ1osU0FBUyxDQUFDLE9BQU8sY0FBYztBQUFBLE1BQy9CLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUE7QUFBQSxNQUVMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQTtBQUFBLE1BRXBDLE1BQU8sS0FBSyxRQUFRLGtDQUFXLElBQUk7QUFBQSxJQUNyQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFNBQVM7QUFBQSxNQUNQLFNBQVMsQ0FBQyxTQUFTLEdBQUcsYUFBYSxDQUFDO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
