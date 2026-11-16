<?php

namespace App\Simulation;

/**
 * An axis-aligned box of decoration grid cells: a minimum corner plus a size.
 */
final readonly class GridBox
{
    public function __construct(
        public int $x,
        public int $y,
        public int $z,
        public int $width,
        public int $height,
        public int $depth,
    ) {}

    public function maxX(): int
    {
        return $this->x + $this->width;
    }

    public function maxY(): int
    {
        return $this->y + $this->height;
    }

    public function maxZ(): int
    {
        return $this->z + $this->depth;
    }

    /**
     * Whether the two boxes' floor plans overlap, ignoring height.
     */
    public function overlapsFootprint(GridBox $other): bool
    {
        return $this->x < $other->maxX() && $other->x < $this->maxX()
            && $this->z < $other->maxZ() && $other->z < $this->maxZ();
    }

    /**
     * Whether a grid column (x, z) falls within the box's floor plan.
     */
    public function coversColumn(int $x, int $z): bool
    {
        return $x >= $this->x && $x < $this->maxX() && $z >= $this->z && $z < $this->maxZ();
    }

    /**
     * Whether the straight line between two points (in grid cell units) passes through the box.
     *
     * @param  array{0: float, 1: float, 2: float}  $from
     * @param  array{0: float, 1: float, 2: float}  $to
     */
    public function intersectsSegment(array $from, array $to): bool
    {
        $enter = 0.0;
        $leave = 1.0;
        $min = [$this->x, $this->y, $this->z];
        $max = [$this->maxX(), $this->maxY(), $this->maxZ()];

        for ($axis = 0; $axis < 3; $axis++) {
            $delta = $to[$axis] - $from[$axis];

            if (abs($delta) < 1e-9) {
                if ($from[$axis] < $min[$axis] || $from[$axis] > $max[$axis]) {
                    return false;
                }

                continue;
            }

            $near = ($min[$axis] - $from[$axis]) / $delta;
            $far = ($max[$axis] - $from[$axis]) / $delta;

            $enter = max($enter, min($near, $far));
            $leave = min($leave, max($near, $far));

            if ($enter > $leave) {
                return false;
            }
        }

        return true;
    }

    /**
     * Gap in cells between the two floor plans (0 when they touch or overlap).
     */
    public function footprintGap(GridBox $other): int
    {
        $gapX = max(0, $other->x - $this->maxX(), $this->x - $other->maxX());
        $gapZ = max(0, $other->z - $this->maxZ(), $this->z - $other->maxZ());

        return max($gapX, $gapZ);
    }
}
