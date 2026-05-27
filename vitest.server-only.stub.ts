// Empty stub. Real `server-only` package throws when bundled into a client
// build to prevent server code leaking to the browser. In tests we run under
// node/jsdom and have no such bundling — the guard is irrelevant here.
export {};
