import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  basename: process.env.NODE_ENV == "production" ? "/tech-news" : "/",
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
} satisfies Config;
