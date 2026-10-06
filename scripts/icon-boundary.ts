import type { Plugin } from 'vite';

export const iconBoundary = (): Plugin => ({
  name: 'server-rendered-icons',
  enforce: 'pre',
  resolveId(source) {
    if (source.includes('@hugeicons/') || /(?:^|\/)server\/ui\/Icon\.tsx$/.test(source)) {
      this.error(`Icons must be rendered on the server inside a gated contribution: ${source}`);
    }
    return null;
  },
});
