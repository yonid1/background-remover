import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built site also works from a sub-folder
  // (for example GitHub Pages at https://<user>.github.io/<repo>/).
  base: './',
});
