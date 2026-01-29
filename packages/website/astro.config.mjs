import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://rubenmavarezb.github.io',
  base: '/aidf',
  integrations: [
    starlight({
      title: 'AIDF',
      description: 'AI-Integrated Development Framework — Structure your AI context. Automate your development tasks.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/rubenmavarezb/aidf' },
        { icon: 'x.com', label: 'X', href: 'https://x.com/AIDFdev' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Core Concepts', slug: 'docs/concepts' },
            { label: 'Setup Guide', slug: 'docs/setup' },
            { label: 'Writing AGENTS.md', slug: 'docs/agents-file' },
          ],
        },
        {
          label: 'Framework',
          items: [
            { label: 'Defining Roles', slug: 'docs/roles' },
            { label: 'Task Design', slug: 'docs/tasks' },
            { label: 'Best Practices', slug: 'docs/best-practices' },
          ],
        },
        {
          label: 'CLI Features',
          items: [
            { label: 'Integrations', slug: 'docs/integrations' },
            { label: 'Git Hooks', slug: 'docs/hooks' },
            { label: 'Notifications', slug: 'docs/notifications' },
          ],
        },
      ],
    }),
  ],
});
