import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Mobile Configuration for FLAPPY WING (Android & iOS)
 * You can customize appId (Package Name / Bundle Identifier) and appName below before running `npm run cap:sync`.
 */
const config: CapacitorConfig = {
  appId: 'com.flappywing.arcade',
  appName: 'FLAPPY WING',
  webDir: 'dist',
  backgroundColor: '#090d16',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
};

export default config;
