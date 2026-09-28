import { defineConfig } from 'astro/config';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  site: process.env.PUBLIC_SITE_URL || (isGitHubPages ? 'https://two-spoons-gluten-free.github.io' : undefined),
  base: isGitHubPages ? '/twospoons-website' : undefined,
});
