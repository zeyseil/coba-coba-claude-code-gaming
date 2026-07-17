import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Only the dev server; `vite build` output is untouched, so the Android build
  // is unaffected by anything here.
  //
  // strictPort matters because src-tauri/tauri.conf.json hardcodes devUrl to
  // this port. Vite's default is to quietly move to the next free port when 5173
  // is taken, which leaves `tauri dev` loading whatever else is on 5173 instead
  // of failing — a wrong app that looks like the right one. Better to refuse.
  server: {
    port: 5173,
    strictPort: true,
  },
});
