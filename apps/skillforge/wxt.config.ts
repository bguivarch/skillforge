import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  srcDir: '.',
  outDir: 'dist',

  manifest: {
    name: 'SkillForge',
    description: 'Sync team skills to your Claude.ai account from a shared config',
    version: '0.1.0',

    permissions: [
      'storage',
      'cookies',
    ],

    host_permissions: [
      'https://claude.ai/*',
      'https://*.claude.ai/*',
      'https://*.r2.dev/*',
    ],

    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },

    action: {
      default_popup: 'popup.html',
      default_title: 'SkillForge',
    },
  },
});
