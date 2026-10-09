/** Minimal hash router: "#/people" -> "/people". */
class Router {
  path = $state(readPath());

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => (this.path = readPath()));
    }
  }

  go(path: string) {
    location.hash = path;
  }
}

function readPath(): string {
  if (typeof location === 'undefined') return '/';
  return location.hash.replace(/^#/, '') || '/';
}

export const router = new Router();
