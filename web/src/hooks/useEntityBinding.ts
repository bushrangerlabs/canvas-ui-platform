/**
 * Platform stub — entity binding via HA is replaced by platform data sources.
 * Returns the fallback value until real data-source wiring is implemented.
 */
export function useEntityBinding(_config: Record<string, any>, _fieldName: string | undefined): string | undefined {
  return _fieldName;
}
