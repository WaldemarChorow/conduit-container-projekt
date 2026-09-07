export const environment = {
  production: true,
  // Relative URL: the browser calls this nginx origin, which reverse-proxies
  // /api to the backend container internally (see conduit-frontend/nginx.conf).
  // No backend host/IP is baked into the bundle, and there's no cross-origin
  // request at all from the browser's point of view.
  apiUrl: "/api",
};
