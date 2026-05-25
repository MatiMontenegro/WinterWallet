import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
      manifest: {
        name: "WinterWallet",
        short_name: "WinterWallet",
        description: "Real, non-custodial EVM wallet — installable on iPhone.",
        theme_color: "#0b0d18",
        background_color: "#0b0d18",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the JSON-RPC and price APIs network-first so the app feels instant
        // but always reflects fresh state when online.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.coingecko\.com\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "coingecko-cache", networkTimeoutSeconds: 4, expiration: { maxEntries: 64, maxAgeSeconds: 300 } },
          },
        ],
        navigateFallbackDenylist: [/^\/api/, /^\/functions\/v1/],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          web3: ["wagmi", "viem", "@rainbow-me/rainbowkit"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: { host: true, port: 5173 },
});
