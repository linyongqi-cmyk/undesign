export function imageSrc(path: string, base = import.meta.env.BASE_URL): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return `${base}${path.replace(/^\//, '')}`;
}
