# Docs

## [Code conventions](./code-conventions.md)

## Math

- [MATH.md](../MATH.md) — authoritative model documentation (v2): derivations,
  v1→v2 change log with rationale, references. Update it when the math changes.
- [zenith.md](../zenith.md) — frozen source article (historical reference only).
- [`zenith.test.ts`](../src/lib/business/model/zenith.test.ts) — executable
  spec: every derivation is verified numerically (closed forms vs. integration,
  root equations, allocator vs. brute force).
