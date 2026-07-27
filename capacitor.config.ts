import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.sharekitchenheart',
  appName: 'Share Kitchen Heart',
  webDir: 'dist',

  android: {
    allowMixedContent: false
  }
};

export default config;