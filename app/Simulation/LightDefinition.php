<?php

namespace App\Simulation;

/**
 * Immutable view of a catalogue light fixture.
 *
 * `output` is the light the fixture gives at full brightness, per gantry slot
 * it spans (tubes) or in total (point fixtures), in the simulation's light
 * units (see LightField). `beamAngle` is the full cone angle in degrees for
 * point fixtures; tubes spread light like a bare bulb.
 */
final readonly class LightDefinition
{
    public function __construct(
        public string $slug,
        public string $name,
        public string $description,
        public bool $isTube,
        public float $output,
        public float $beamAngle,
        public string $defaultColour,
        public int $minLength = 1,
    ) {}

    /**
     * Cosine of the angle from straight down where the beam has faded out.
     */
    public function cosOuter(): float
    {
        return cos(deg2rad($this->beamAngle / 2));
    }

    /**
     * Cosine of the angle from straight down where the beam starts to fade.
     */
    public function cosInner(): float
    {
        return cos(deg2rad($this->beamAngle / 2 * 0.6));
    }
}
