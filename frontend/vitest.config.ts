import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Frontend unit + component tests. The React plugin provides the JSX transform
// (tsconfig is jsx:preserve for Next), jsdom gives a DOM, the `@/` alias is
// resolved, and `vitest.setup.ts` shims `jest`→`vi` + loads jest-dom matchers.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        include: [
            'lib/**/*.test.ts',
            '__tests__/worker-compliance.test.ts',
            '__tests__/worker-offline.test.ts',
            '__tests__/audit-pack-components.test.tsx',
        ],
    },
});
