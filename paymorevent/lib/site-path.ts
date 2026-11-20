export function sitePath(path = '') {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export function assetPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') ? sitePath(path) : path;
}
