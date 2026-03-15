export async function optionalImport<T>(
  specifier: string,
): Promise<T | undefined> {
  try {
    const importer = new Function(
      'modulePath',
      'return import(modulePath);',
    ) as (modulePath: string) => Promise<T>;
    return await importer(specifier);
  } catch {
    return undefined;
  }
}
