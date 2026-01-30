import { setRoute } from '../store/actions.ts';

// Route definition
interface Route {
  path: string;
  pattern: RegExp;
  params: string[];
}

// Parsed route match
export interface RouteMatch {
  route: string;
  params: Record<string, string>;
}

// Define application routes
const routes: Route[] = [
  { path: '/', pattern: /^\/$/,params: [] },
  { path: '/submit', pattern: /^\/submit$/, params: [] },
  { path: '/inbox', pattern: /^\/inbox$/, params: [] },
  { path: '/preview/:jobId', pattern: /^\/preview\/([^/]+)$/, params: ['jobId'] },
  { path: '/audit', pattern: /^\/audit$/, params: [] },
  { path: '/audit/:jobId', pattern: /^\/audit\/([^/]+)$/, params: ['jobId'] },
  { path: '/logs/:jobId', pattern: /^\/logs\/([^/]+)$/, params: ['jobId'] },
  { path: '/principles', pattern: /^\/principles$/, params: [] },
];

// Route change callback
type RouteCallback = (match: RouteMatch) => void;

// Router state
let currentCallback: RouteCallback | null = null;

// Parse current hash into route and params
export function parseHash(): RouteMatch {
  const hash = window.location.hash.slice(1) || '/';

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.params.forEach((param, index) => {
        params[param] = match[index + 1];
      });
      return { route: route.path, params };
    }
  }

  // Default to home if no match
  return { route: '/', params: {} };
}

// Navigate to a route
export function navigate(path: string): void {
  window.location.hash = path;
}

// Initialize router
export function initRouter(callback: RouteCallback): void {
  currentCallback = callback;

  // Handle hash changes
  const handleHashChange = () => {
    const match = parseHash();
    setRoute(match.route);
    if (currentCallback) {
      currentCallback(match);
    }
  };

  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);

  // Handle initial route
  handleHashChange();
}

// Get current route match
export function getCurrentRoute(): RouteMatch {
  return parseHash();
}

// Route helpers
export const routes_paths = {
  home: () => '/',
  submit: () => '/submit',
  inbox: () => '/inbox',
  preview: (jobId: string) => `/preview/${jobId}`,
  audit: () => '/audit',
  auditJob: (jobId: string) => `/audit/${jobId}`,
  logs: (jobId: string) => `/logs/${jobId}`,
  principles: () => '/principles',
};
