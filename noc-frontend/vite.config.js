import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_API_TARGET || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // En desarrollo el navegador habla solo con Vite; Vite reenvía API y WebSocket al backend (sin CORS).
      proxy: {
        '/api': target,
        '/socket.io': { target, ws: true },
      },
    },
  };
});
