import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both off deliberately: shots are static design pieces, and cacheComponents
  // brings Suspense/caching rules that get in the way here for no benefit.
  // partialPrefetching depends on it, so it goes too.
  // The dev overlay badge would otherwise land in every captured poster.
  devIndicators: false,
  turbopack: {
    rules: {
      // Must NOT be "*.css": that glob also matches *.module.css and running
      // the Tailwind loader over a CSS Module destroys its class mapping, so
      // every shot renders unstyled. Shots use CSS Modules; only the shell's
      // global sheet needs Tailwind.
      "**/globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
