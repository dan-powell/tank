<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The substrate heightmap moves from 1 cm (5 cell) squares to a height for
 * every 0.2 cm grid column, stored as run-length [height, count, ...] pairs.
 * Each sculpted heightmap is interpolated between the old squares' centres,
 * so slopes come out as 0.2 cm steps rather than 1 cm blocks.
 */
return new class extends Migration
{
    /** Cells per side of an old heightmap square. */
    private const int SQUARE = 5;

    /** Height of an unsculpted substrate, in cells. */
    private const int DEFAULT_HEIGHT = 10;

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->convert(function (array $squares, int $width, int $depth): array {
            $columns = (int) ceil($width / self::SQUARE);
            $rows = (int) ceil($depth / self::SQUARE);
            $square = fn (int $column, int $row): float => (float) ($squares[
                min($rows - 1, max(0, $row)) * $columns + min($columns - 1, max(0, $column))
            ] ?? self::DEFAULT_HEIGHT);
            $runs = [];

            for ($z = 0; $z < $depth; $z++) {
                $v = ($z + 0.5) / self::SQUARE - 0.5;
                $row = (int) floor($v);
                $fz = $v - $row;

                for ($x = 0; $x < $width; $x++) {
                    $u = ($x + 0.5) / self::SQUARE - 0.5;
                    $column = (int) floor($u);
                    $fx = $u - $column;
                    $height = (int) round(
                        ($square($column, $row) * (1 - $fx) + $square($column + 1, $row) * $fx) * (1 - $fz)
                        + ($square($column, $row + 1) * (1 - $fx) + $square($column + 1, $row + 1) * $fx) * $fz,
                    );

                    $last = count($runs) - 2;

                    if ($last >= 0 && $runs[$last] === $height) {
                        $runs[$last + 1]++;
                    } else {
                        array_push($runs, $height, 1);
                    }
                }
            }

            return $runs;
        });
    }

    /**
     * Reverse the migrations: each old square takes the height at its centre.
     */
    public function down(): void
    {
        $this->convert(function (array $runs, int $width, int $depth): array {
            $heights = [];

            for ($index = 0; $index + 1 < count($runs); $index += 2) {
                array_push($heights, ...array_fill(0, max(0, (int) $runs[$index + 1]), (int) $runs[$index]));
            }

            $squares = [];
            $half = intdiv(self::SQUARE, 2);

            for ($row = 0; $row < (int) ceil($depth / self::SQUARE); $row++) {
                for ($column = 0; $column < (int) ceil($width / self::SQUARE); $column++) {
                    $x = min($width - 1, $column * self::SQUARE + $half);
                    $z = min($depth - 1, $row * self::SQUARE + $half);
                    $squares[] = $heights[$z * $width + $x] ?? self::DEFAULT_HEIGHT;
                }
            }

            return $squares;
        });
    }

    /**
     * @param  Closure(array<int, int>, int, int): list<int>  $convert
     */
    private function convert(Closure $convert): void
    {
        DB::table('tanks')->whereNotNull('substrate_heights')->orderBy('id')
            ->chunkById(100, function ($tanks) use ($convert): void {
                foreach ($tanks as $tank) {
                    $heights = $convert(json_decode($tank->substrate_heights, true), $tank->grid_width, $tank->grid_depth);

                    DB::table('tanks')->where('id', $tank->id)->update(['substrate_heights' => json_encode($heights)]);
                }
            });
    }
};
