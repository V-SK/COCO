export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, currentValue) => {
    if (typeof currentValue === 'bigint') {
      return currentValue.toString();
    }

    return currentValue;
  });
}
