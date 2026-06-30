import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Frontend unit tests. Resolves the `@/` path alias, runs in jsdom (the offline
// suite touches window/localStorage), and shims `jest`→`vi` for the pre-existing
// suites. The audit-pack component test is excluded for now — it needs
// @testing-library/react + user-event and a jest→vi rewrite (tracked follow-up).
export default defineConfig({
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
        ],
    },
});
