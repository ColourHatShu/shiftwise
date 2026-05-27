// Jest manual mock for the ESM-only `pdf-to-img` package.
// The real module exports an async generator; tests don't need OCR, so we
// return an empty iterator and a no-op pdf() function.
module.exports = {
  pdf: async function* mockPdfPages() {
    // empty generator — no pages
  },
  default: async function* mockPdfDefault() {
    // empty generator — no pages
  },
};
