import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig, lazyPlugins } from 'vite-plus';

/** Set inside the DDEV web container, e.g. https://tank.ddev.site. */
const ddevUrl = process.env.DDEV_PRIMARY_URL;

export default defineConfig({
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        inertia(),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ]),
    server: {
        // Under DDEV the browser reaches Vite through the DDEV router on port
        // 5173 (see .ddev/config.tank.yaml), not on 127.0.0.1.
        ...(ddevUrl && {
            host: '0.0.0.0',
            port: 5173,
            strictPort: true,
            origin: `${ddevUrl.replace(/:\d+$/, '')}:5173`,
            cors: { origin: /^https?:\/\/([\w-]+\.)*ddev\.site(:\d+)?$/ },
        }),
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
            ],
        },
    },
    lint: {
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'public/**',
            'bootstrap/ssr/**',
            'tailwind.config.js',
            'resources/js/actions/**',
            'resources/js/components/ui/*',
            'resources/js/routes/**',
            'resources/js/wayfinder/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: [
            '.github/**',
            '.ddev/**',
            '.ai/**',
            '.claude/**',
            '.mcp.json',
            '.styleci.yml',
            'CHANGELOG.md',
            'CLAUDE.md',
            'AGENTS.md',
            'boost.json',
            'provision/**',
            'composer.json',
            'public/build/**',
            'resources/js/components/ui/*',
            'resources/views/mail/*',
        ],
        sortTailwindcss: {
            functions: ['clsx', 'cn', 'cva'],
            stylesheet: 'resources/css/app.css',
        },
    },
});
