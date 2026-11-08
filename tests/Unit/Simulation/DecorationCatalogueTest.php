<?php

namespace Tests\Unit\Simulation;

use App\Enums\DecorationSource;
use App\Simulation\DecorationCatalogue;
use App\Simulation\DecorationDefinition;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class DecorationCatalogueTest extends TestCase
{
    /**
     * @return iterable<string, array{0: DecorationDefinition}>
     */
    public static function voxDecorations(): iterable
    {
        foreach (DecorationCatalogue::definitions() as $slug => $definition) {
            if ($definition->source === DecorationSource::Vox) {
                yield $slug => [$definition];
            }
        }
    }

    #[DataProvider('voxDecorations')]
    public function test_vox_models_match_their_catalogue_size_and_anchors(DecorationDefinition $definition): void
    {
        [$size, $solid] = $this->readVox(dirname(__DIR__, 3)."/resources/models/decor/{$definition->slug}.vox");

        $this->assertSame($definition->size, $size);

        foreach ($definition->anchors as [$x, $y, $z]) {
            $this->assertFalse(isset($solid["{$x},{$y},{$z}"]), "Anchor {$x},{$y},{$z} of {$definition->slug} is inside the model.");
            $this->assertTrue(isset($solid["{$x},".($y - 1).",{$z}"]), "Anchor {$x},{$y},{$z} of {$definition->slug} has nothing beneath it.");
        }
    }

    public function test_a_quarter_turn_swaps_width_and_depth_and_moves_cells_like_a_ninety_degree_turn(): void
    {
        $definition = DecorationCatalogue::find('boulder');

        $this->assertSame([55, 45, 65], $definition->rotatedSize(1));
        $this->assertSame([28, 43, 31], $definition->rotateCell([33, 43, 28], 1));
        $this->assertSame([31, 43, 26], $definition->rotateCell([33, 43, 28], 2));
        $this->assertSame([26, 43, 33], $definition->rotateCell([33, 43, 28], 3));
        $this->assertSame([0, 0, 64], $definition->rotateCell([0, 0, 0], 1));
    }

    /**
     * Read a MagicaVoxel file's first model in grid space (x, y up, z towards the viewer).
     *
     * @return array{0: array{0: int, 1: int, 2: int}, 1: array<string, true>}
     */
    private function readVox(string $path): array
    {
        $data = file_get_contents($path) ?: throw new RuntimeException("Cannot read {$path}");
        $offset = 20;
        $size = null;
        $solid = [];

        while ($offset < strlen($data)) {
            $id = substr($data, $offset, 4);
            $length = unpack('V', $data, $offset + 4)[1];
            $content = $offset + 12;

            if ($id === 'SIZE') {
                [, $width, $depth, $height] = unpack('V3', $data, $content);
                $size = [$width, $height, $depth];
            } elseif ($id === 'XYZI' && $size !== null) {
                $count = unpack('V', $data, $content)[1];

                for ($i = 0; $i < $count; $i++) {
                    [, $voxX, $voxY, $voxZ] = unpack('C3', $data, $content + 4 + $i * 4);
                    $solid[$voxX.','.$voxZ.','.($size[2] - 1 - $voxY)] = true;
                }

                return [$size, $solid];
            }

            $offset = $content + $length;
        }

        throw new RuntimeException("No model found in {$path}");
    }
}
