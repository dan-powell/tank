<?php

namespace App\Simulation;

use App\Models\Tank;

/**
 * The frame above a tank that light fixtures hang from: a grid of slots,
 * `columns` across the tank's width and `rows` front to back. Fixtures sit
 * `CLEARANCE` grid cells above the rim; tubes run along a row.
 */
final readonly class Gantry
{
    /** Width of one gantry column, in cm. */
    public const int SLOT_CM = 5;

    /** Height of the gantry above the rim, in grid cells (8 cm). */
    public const int CLEARANCE = 40;

    public function __construct(
        public int $columns,
        public int $rows,
        public int $gridWidth,
        public int $gridHeight,
        public int $gridDepth,
    ) {}

    public static function forGrid(int $width, int $height, int $depth): self
    {
        $widthCm = $width / TankGeometry::CELLS_PER_CM;
        $depthCm = $depth / TankGeometry::CELLS_PER_CM;

        return new self(
            columns: max(2, (int) floor($widthCm / self::SLOT_CM)),
            rows: min(4, max(2, (int) round($depthCm / 9))),
            gridWidth: $width,
            gridHeight: $height,
            gridDepth: $depth,
        );
    }

    public static function of(Tank $tank): self
    {
        return self::forGrid($tank->grid_width, $tank->grid_height, $tank->grid_depth);
    }

    /**
     * Whether a fixture of `length` slots starting at a slot lies on the gantry.
     */
    public function fits(int $column, int $row, int $length): bool
    {
        return $column >= 0 && $row >= 0 && $length >= 1
            && $column + $length <= $this->columns
            && $row < $this->rows;
    }

    /**
     * The grid x of a (fractional) column position: 0 is the left edge of the first slot.
     */
    public function x(float $column): float
    {
        return $column * $this->gridWidth / $this->columns;
    }

    /**
     * The grid z of the middle of a row.
     */
    public function z(int $row): float
    {
        return ($row + 0.5) * $this->gridDepth / $this->rows;
    }

    /**
     * The grid y the fixtures hang at.
     */
    public function y(): float
    {
        return $this->gridHeight + self::CLEARANCE;
    }

    /**
     * Attributes for the light every new tank starts with: one LED tube the
     * full length of the middle row, on the default schedule.
     *
     * @return array<string, mixed>
     */
    public function defaultFixture(): array
    {
        return [
            'type' => 'led-tube',
            'column' => 0,
            'row' => intdiv($this->rows - 1, 2),
            'length' => $this->columns,
            'colour' => LightCatalogue::find('led-tube')->defaultColour,
            'brightness' => config('simulation.lighting.default_brightness'),
            ...config('simulation.lighting.default_schedule'),
        ];
    }
}
