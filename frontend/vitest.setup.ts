import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// The pre-existing __tests__ suites were authored against Jest's `jest.fn()` API.
// Alias it to vitest's `vi` so they run unmodified.
(globalThis as unknown as { jest: typeof vi }).jest = vi;
