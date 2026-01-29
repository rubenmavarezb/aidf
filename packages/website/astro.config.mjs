import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://rubenmavarezb.github.io',
  base: '/aidf',
  integrations: [
    mermaid(),
    starlight({
      title: 'AIDF',
      description: 'AI-Integrated Development Framework — Structure your AI context. Automate your development tasks.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/rubenmavarezb/aidf' },
      ],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
        pt: { label: 'Português', lang: 'pt' },
        fr: { label: 'Français', lang: 'fr' },
      },
      sidebar: [
        {
          label: 'Getting Started',
          translations: {
            es: 'Primeros Pasos',
            pt: 'Primeiros Passos',
            fr: 'Démarrage',
          },
          items: [
            { label: 'Core Concepts', slug: 'docs/concepts', translations: { es: 'Conceptos Clave', pt: 'Conceitos Fundamentais', fr: 'Concepts Clés' } },
            { label: 'Setup Guide', slug: 'docs/setup', translations: { es: 'Guía de Configuración', pt: 'Guia de Configuração', fr: 'Guide d\'Installation' } },
            { label: 'Writing AGENTS.md', slug: 'docs/agents-file', translations: { es: 'Escribir AGENTS.md', pt: 'Escrevendo AGENTS.md', fr: 'Rédiger AGENTS.md' } },
          ],
        },
        {
          label: 'Framework',
          items: [
            { label: 'Architecture', slug: 'docs/architecture', translations: { es: 'Arquitectura', pt: 'Arquitetura', fr: 'Architecture' } },
            { label: 'Defining Roles', slug: 'docs/roles', translations: { es: 'Definir Roles', pt: 'Definindo Roles', fr: 'Définir les Rôles' } },
            { label: 'Task Design', slug: 'docs/tasks', translations: { es: 'Diseño de Tareas', pt: 'Design de Tarefas', fr: 'Conception de Tâches' } },
            { label: 'Best Practices', slug: 'docs/best-practices', translations: { es: 'Buenas Prácticas', pt: 'Boas Práticas', fr: 'Bonnes Pratiques' } },
          ],
        },
        {
          label: 'CLI Features',
          translations: {
            es: 'Funciones del CLI',
            pt: 'Recursos do CLI',
            fr: 'Fonctionnalités CLI',
          },
          items: [
            { label: 'Agent Skills', slug: 'docs/skills', translations: { es: 'Agent Skills', pt: 'Agent Skills', fr: 'Agent Skills' } },
            { label: 'Integrations', slug: 'docs/integrations', translations: { es: 'Integraciones', pt: 'Integrações', fr: 'Intégrations' } },
            { label: 'Git Hooks', slug: 'docs/hooks' },
            { label: 'Notifications', slug: 'docs/notifications', translations: { es: 'Notificaciones', pt: 'Notificações' } },
            { label: 'FAQ', slug: 'docs/faq', translations: { es: 'Preguntas Frecuentes', pt: 'Perguntas Frequentes', fr: 'Foire aux Questions' } },
          ],
        },
      ],
    }),
  ],
});
