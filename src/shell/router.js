// Tiny hash router. Paths look like #/menu, #/about, #/chapter/lake-ulysses
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [screen, ...rest] = hash.split('/').filter(Boolean);
  return { screen: screen || 'title', param: rest.join('/') || null };
}

export function navigate(path) {
  location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function onRouteChange(handler) {
  const fire = () => handler(parseHash());
  window.addEventListener('hashchange', fire);
  fire(); // fire immediately with current route
  return () => window.removeEventListener('hashchange', fire);
}

export function getCurrentRoute() {
  return parseHash();
}
