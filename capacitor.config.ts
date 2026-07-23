import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.sharekitchenheart',
  appName: 'Share Kitchen Heart',
  webDir: 'dist',
  server: {
    url: 'https://share-kitchen-heart.lovable.app',
    cleartext: false,
  },
};

export default config;
