/**
 * Cloudflare Workers runtime methods can throw "Illegal invocation" when a
 * native function is detached from its original runtime object and later
 * invoked with a different `this` value (for example as a class property).
 *
 * Always call the runtime fetch through globalThis so the native method keeps
 * the correct receiver. Tests may still inject their own fetch implementation.
 */
export const runtimeFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, init);
