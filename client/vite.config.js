import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Everything under /api is proxied to Express. The browser therefore
      // only ever sees http://localhost:5173/api/videos/:lessonId/stream —
      // never a drive.google.com URL.
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      // Real-time notifications (Socket.IO) — needs the websocket upgrade proxied too.
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
