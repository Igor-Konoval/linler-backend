import * as path from 'path';

export function resolveDataPath(configuredPath: string): string {
  const trimmed = configuredPath.trim();

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  return path.join(process.cwd(), trimmed);
}

export function toPublicUrlPath(configuredPath: string): string {
  const normalized = configuredPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
