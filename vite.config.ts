import path from "path"
import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/tech-news/' : '/';

  return ({
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    },
    plugins: [reactRouter(), tsconfigPaths()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./app"),
      },
    },
  })
});
