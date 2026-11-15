<?php

namespace App\Simulation;

use InvalidArgumentException;

/**
 * The light fixtures that can hang from a tank's gantry.
 */
final class LightCatalogue
{
    /**
     * @return array<string, LightDefinition>
     */
    public static function definitions(): array
    {
        return [
            'led-tube' => new LightDefinition(
                slug: 'led-tube',
                name: 'LED tube',
                description: 'A long bar of even light along the tank. The all-rounder.',
                isTube: true,
                output: 1.0,
                beamAngle: 180,
                defaultColour: '#f4f7ff',
                minLength: 2,
            ),
            'spotlight' => new LightDefinition(
                slug: 'spotlight',
                name: 'Spotlight',
                description: 'A narrow, intense beam for a high-light corner or a feature plant.',
                isTube: false,
                output: 14.0,
                beamAngle: 40,
                defaultColour: '#fff1d6',
            ),
            'flood' => new LightDefinition(
                slug: 'flood',
                name: 'LED flood',
                description: 'A wide pool of light from a single point.',
                isTube: false,
                output: 7.0,
                beamAngle: 100,
                defaultColour: '#f4f7ff',
            ),
        ];
    }

    public static function exists(string $slug): bool
    {
        return array_key_exists($slug, self::definitions());
    }

    public static function find(string $slug): LightDefinition
    {
        return self::definitions()[$slug] ?? throw new InvalidArgumentException("Unknown light fixture [{$slug}].");
    }
}
