import { createHash } from 'crypto';

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {} as Record<string, any>);
  }
  return value;
}

export function hashContent(content: Record<string, any>): string {
  // Force a full plain-JSON round-trip FIRST — this strips any Mongoose
  // document/subdocument wrapper, Mixed-type internal state, or
  // non-enumerable metadata that could otherwise make two logically
  // identical objects serialize differently depending on how they were
  // fetched. This is the actual fix if the mismatch is a Mongoose
  // artifact rather than real content drift.
  const plain = JSON.parse(JSON.stringify(content ?? {}));
  const canonical = JSON.stringify(canonicalize(plain));
  return createHash('sha256').update(canonical).digest('hex');
}