import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  vite: {
    optimizeDeps: {
      rolldownOptions: {
        transform: {
          define: {
            'process.env.NODE_ENV': JSON.stringify('development'),
          },
        },
      },
    },
  },
});
