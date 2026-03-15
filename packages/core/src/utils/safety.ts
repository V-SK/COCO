import { URL } from 'node:url';
import { CocoError } from '../errors.js';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[::1\]$/i,
];

const READONLY_SQL_PREFIXES = [
  'select',
  'with',
  'pragma table_info',
  'show',
  'describe',
];
const WRITE_SQL_PATTERNS = [
  /\binsert\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\balter\b/i,
  /\btruncate\b/i,
  /\bcreate\b/i,
  /\breplace\b/i,
];

export function assertAllowedUrl(
  rawUrl: string,
  options: {
    allowPrivateHosts?: boolean | undefined;
    allowedHosts?: string[] | undefined;
    blockedHosts?: string[] | undefined;
  } = {},
): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol === 'file:') {
    throw new CocoError(
      'file:// protocol is not allowed.',
      'url_protocol_blocked',
    );
  }

  const hostname = parsed.hostname;
  if (
    !options.allowPrivateHosts &&
    PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  ) {
    throw new CocoError(
      'Private or local network targets are blocked.',
      'url_private_host_blocked',
    );
  }

  if (
    options.allowedHosts?.length &&
    !options.allowedHosts.includes(hostname)
  ) {
    throw new CocoError(
      'Target hostname is not allowlisted.',
      'url_host_not_allowed',
    );
  }

  if (options.blockedHosts?.includes(hostname)) {
    throw new CocoError('Target hostname is blocked.', 'url_host_blocked');
  }

  return parsed;
}

export function assertReadOnlySql(sql: string): void {
  const normalized = sql.trim().toLowerCase();
  if (READONLY_SQL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    if (!WRITE_SQL_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return;
    }
  }

  if (WRITE_SQL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new CocoError(
      'Write SQL is disabled in readonly mode.',
      'sql_readonly_violation',
    );
  }
}

export function assertSupportedPlatform(platforms: NodeJS.Platform[]): void {
  if (!platforms.includes(process.platform)) {
    throw new CocoError(
      `Unsupported platform ${process.platform}.`,
      'unsupported_platform',
    );
  }
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
