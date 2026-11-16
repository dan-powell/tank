/**
 * Model file URLs keyed by species slug. Drop `{slug}.vox` files into
 * resources/models/species to add or replace a species' look.
 */
export const SPECIES_MODEL_FILES: Record<string, string> = Object.fromEntries(
    Object.entries(
        import.meta.glob<string>('/resources/models/species/*.vox', {
            eager: true,
            query: '?url',
            import: 'default',
        }),
    ).map(([path, url]) => [
        (path.split('/').pop() as string).replace(/\.vox$/, ''),
        url,
    ]),
);
