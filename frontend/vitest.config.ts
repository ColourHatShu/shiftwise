import { defineConfig } from 'vitest/config';

// First increment of frontend testing: scoped to the new co-located unit tests
// under lib/. The pre-existing __tests__/ suites (written before any runner
// existed) need @/ alias resolution + jsdom + @testing-library/react — tracked
// as a follow-up to wire up and get green.
export default defineConfig({
    test: {
        include: ['lib/**/*.test.ts'],
        environment: 'node',
    },
});
