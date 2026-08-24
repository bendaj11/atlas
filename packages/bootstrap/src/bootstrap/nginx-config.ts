export function createNginxConfig(
  assetOrigins: readonly string[] = [],
): string {
  const contentOrigins = normalizedOrigins(assetOrigins);
  const localHttpOrigins = [
    'http://localhost:*',
    'http://127.0.0.1:*',
    'http://[::1]:*',
  ];

  const localWebSocketOrigins = [
    'ws://localhost:*',
    'ws://127.0.0.1:*',
    'ws://[::1]:*',
  ];

  const contentSources = cspSources([...contentOrigins, ...localHttpOrigins]);

  const connectSources = cspSources([
    ...contentOrigins,
    ...localHttpOrigins,
    ...localWebSocketOrigins,
  ]);

  return `server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;

  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' blob:${contentSources}; connect-src 'self' blob:${connectSources}; style-src 'self' 'unsafe-inline' blob:${contentSources}; img-src 'self' data:${contentSources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

  location = /health/live {
    default_type text/plain;
    return 200 "ok\\n";
  }

  location = /atlas.bootstrap.json {
    expires -1;
    try_files $uri =404;
  }

  location = /index.html {
    expires -1;
  }

  location = /atlas.loader.js {
    expires -1;
    try_files $uri =404;
  }

  location ~ \\.[^/]+$ {
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;
}

function normalizedOrigins(origins: readonly string[]): string[] {
  return [
    ...new Set(origins.filter(Boolean).map((origin) => new URL(origin).origin)),
  ];
}

function cspSources(origins: readonly string[]): string {
  return origins.length > 0 ? ` ${origins.join(' ')}` : '';
}
