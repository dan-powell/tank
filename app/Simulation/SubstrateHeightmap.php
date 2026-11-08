<?php

namespace App\Simulation;

use App\Models\Tank;
use WeakMap;

/**
 * The substrate's surface height (in grid cells) at every x/z column of a
 * tank's grid, row by row from the back glass (index = z * width + x).
 *
 * A large tank has well over 100,000 columns, so the heightmap is stored and
 * sent run-length encoded: a flat list of [height, count, height, count, ...]
 * pairs in the same order. An unsculpted tank is a single run.
 */
final class SubstrateHeightmap
{
    /**
     * Heightmaps already decoded, per tank, with the stored value they came from.
     *
     * @var WeakMap<Tank, array{0: mixed, 1: self}>|null
     */
    private static ?WeakMap $decoded = null;

    /**
     * @param  list<int>  $heights  One height per grid column (see the class description).
     */
    private function __construct(
        public readonly int $width,
        public readonly int $depth,
        private readonly array $heights,
    ) {}

    /**
     * A tank's heightmap, decoded once for as long as its stored heights stay the same.
     */
    public static function of(Tank $tank): self
    {
        self::$decoded ??= new WeakMap;
        $stored = $tank->substrate_heights;
        $cached = self::$decoded[$tank] ?? null;

        if ($cached !== null && $cached[0] === $stored && $cached[1]->width === $tank->grid_width && $cached[1]->depth === $tank->grid_depth) {
            return $cached[1];
        }

        $heightmap = $stored === null
            ? self::flat($tank->grid_width, $tank->grid_depth)
            : self::fromRuns($stored, $tank->grid_width, $tank->grid_depth);
        self::$decoded[$tank] = [$stored, $heightmap];

        return $heightmap;
    }

    /**
     * An unsculpted heightmap.
     */
    public static function flat(int $width, int $depth): self
    {
        return new self($width, $depth, array_fill(0, $width * $depth, TankGeometry::DEFAULT_SUBSTRATE));
    }

    /**
     * Decode run-length pairs. Columns the runs fall short of are left unsculpted.
     *
     * @param  array<int, int|string>  $runs
     */
    public static function fromRuns(array $runs, int $width, int $depth): self
    {
        $cells = $width * $depth;
        $runs = array_values($runs);
        $heights = [];

        for ($index = 0; $index + 1 < count($runs) && count($heights) < $cells; $index += 2) {
            $count = min((int) $runs[$index + 1], $cells - count($heights));

            if ($count > 0) {
                array_push($heights, ...array_fill(0, $count, (int) $runs[$index]));
            }
        }

        if (count($heights) < $cells) {
            array_push($heights, ...array_fill(0, $cells - count($heights), TankGeometry::DEFAULT_SUBSTRATE));
        }

        return new self($width, $depth, $heights);
    }

    /**
     * A heightmap from a height for each grid column.
     *
     * @param  callable(int, int): int  $heightAt  Given the column's x and z.
     */
    public static function fromColumns(int $width, int $depth, callable $heightAt): self
    {
        $heights = [];

        for ($z = 0; $z < $depth; $z++) {
            for ($x = 0; $x < $width; $x++) {
                $heights[] = $heightAt($x, $z);
            }
        }

        return new self($width, $depth, $heights);
    }

    /**
     * Run-length encode a list of heights as [height, count, ...] pairs.
     *
     * @param  list<int>  $heights
     * @return list<int>
     */
    public static function encode(array $heights): array
    {
        $runs = [];
        $count = 0;
        $current = null;

        foreach ($heights as $height) {
            if ($height === $current) {
                $count++;

                continue;
            }

            if ($current !== null) {
                array_push($runs, $current, $count);
            }

            $current = $height;
            $count = 1;
        }

        if ($current !== null) {
            array_push($runs, $current, $count);
        }

        return $runs;
    }

    /**
     * The heightmap as run-length pairs, ready to store or send.
     *
     * @return list<int>
     */
    public function toRuns(): array
    {
        return self::encode($this->heights);
    }

    /**
     * Every column's height, row by row from the back glass.
     *
     * @return list<int>
     */
    public function heights(): array
    {
        return $this->heights;
    }

    /**
     * Height of the surface at a grid column; positions outside the tank use the nearest edge.
     */
    public function heightAt(int $x, int $z): int
    {
        $x = min($this->width - 1, max(0, $x));
        $z = min($this->depth - 1, max(0, $z));

        return $this->heights[$z * $this->width + $x];
    }
}
