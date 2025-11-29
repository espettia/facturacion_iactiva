import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carga variables de entorno si existen
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Inyectamos la API Key de manera segura durante el build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "AIzaSyCHTqovHreeq1cGOFpJfTbpwhmJyd1_vr8")
    }
  };
});