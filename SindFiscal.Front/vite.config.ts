import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  //Avisa para procurar o .env o nivel acima ja que ele nao existe no mesmo nivel do package.json
  envDir: path.resolve(__dirname, "../"),

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5195",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
