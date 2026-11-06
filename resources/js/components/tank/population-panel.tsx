import type { CreatureSnapshot, PlantSnapshot, Species } from '@/types';

type Props = {
    creatures: CreatureSnapshot[];
    plants: PlantSnapshot[];
    species: Species[];
};

export function PopulationPanel({ creatures, plants, species }: Props) {
    const rows = species
        .map((definition) => {
            const members =
                definition.kind === 'plant'
                    ? plants.filter(
                          (plant) => plant.species_id === definition.id,
                      )
                    : creatures.filter(
                          (creature) => creature.species_id === definition.id,
                      );
            const averageHealth =
                members.reduce((total, member) => total + member.health, 0) /
                Math.max(members.length, 1);
            const fry =
                definition.kind === 'plant'
                    ? 0
                    : creatures.filter(
                          (creature) =>
                              creature.species_id === definition.id &&
                              creature.size <
                                  (definition.adult_size ?? 1) * 0.35,
                      ).length;
            const pregnant = creatures.filter(
                (creature) =>
                    creature.species_id === definition.id &&
                    creature.is_pregnant,
            ).length;

            return {
                definition,
                count: members.length,
                averageHealth,
                fry,
                pregnant,
            };
        })
        .filter((row) => row.count > 0);

    return (
        <section aria-labelledby="population-heading" className="space-y-2">
            <h2 id="population-heading" className="text-sm font-semibold">
                Inhabitants
            </h2>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    The tank is empty.
                </p>
            ) : (
                <ul className="space-y-1.5 text-sm">
                    {rows.map(
                        ({
                            definition,
                            count,
                            averageHealth,
                            fry,
                            pregnant,
                        }) => (
                            <li
                                key={definition.id}
                                className="flex items-center justify-between gap-2"
                            >
                                <span>
                                    {definition.name}
                                    {fry > 0 && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            · {fry} fry
                                        </span>
                                    )}
                                    {pregnant > 0 && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            · {pregnant} pregnant
                                        </span>
                                    )}
                                </span>
                                <span className="flex items-center gap-2 tabular-nums">
                                    <span
                                        className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
                                        title={`Average health ${Math.round(averageHealth * 100)}%`}
                                    >
                                        <span
                                            className="block h-full rounded-full bg-emerald-500"
                                            style={{
                                                width: `${Math.round(averageHealth * 100)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="w-6 text-right font-medium">
                                        {count}
                                    </span>
                                </span>
                            </li>
                        ),
                    )}
                </ul>
            )}
        </section>
    );
}
