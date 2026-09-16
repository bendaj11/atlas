const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.includes(hostname);
}
