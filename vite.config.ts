import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    // Không dùng thư mục public làm nguồn đầu vào,
    // vì Vite sẽ build kết quả trực tiếp vào public.
    publicDir: false,

    build: {
      outDir: "public",
      emptyOutDir: true,
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
