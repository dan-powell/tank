<?php

namespace Tests\Unit\Simulation;

use App\Enums\SpeciesKind;
use App\Simulation\SpeciesCatalogue;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class SpeciesModelsTest extends TestCase
{
    /**
     * @return iterable<string, array{0: string, 1: array<string, int|float>}>
     */
    public static function staged(): iterable
    {
        foreach (SpeciesCatalogue::definitions() as $slug => $definition) {
            $stages = $definition['params']['render']['stages'] ?? null;

            if ($stages !== null) {
                yield $slug => [$slug, $stages];
            }
        }
    }

    /**
     * @param  array<string, int|float>  $stages
     */
    #[DataProvider('staged')]
    public function test_stages_start_at_zero_and_grow_in_order(string $slug, array $stages): void
    {
        $sizes = array_values($stages);

        $this->assertSame(0, $sizes[0], "{$slug}'s first stage must start at size 0.");
        $this->assertSame($sizes, collect($sizes)->sort()->values()->all(), "{$slug}'s stages are out of order.");
    }

    /**
     * @param  array<string, int|float>  $stages
     */
    #[DataProvider('staged')]
    public function test_each_stage_has_frames_in_the_species_model(string $slug, array $stages): void
    {
        $names = $this->objectNames(dirname(__DIR__, 3)."/resources/models/species/{$slug}.vox");

        foreach (array_keys($stages) as $stage) {
            $this->assertTrue(
                in_array("{$stage}.idle.0", $names, true) || in_array("{$stage}.move.0", $names, true),
                "{$slug}.vox has no idle or move frames for its {$stage} stage.",
            );
        }
    }

    /**
     * @return iterable<string, array{0: string, 1: string}>
     */
    public static function plants(): iterable
    {
        foreach (SpeciesCatalogue::definitions() as $slug => $definition) {
            if ($definition['kind'] === SpeciesKind::Plant) {
                yield $slug => [$slug, $definition['behaviour']];
            }
        }
    }

    #[DataProvider('plants')]
    public function test_each_plant_model_has_the_parts_it_is_built_from(string $slug, string $behaviour): void
    {
        $names = $this->objectNames(dirname(__DIR__, 3)."/resources/models/species/{$slug}.vox");
        $required = $behaviour === 'cushion' ? ['patch.0'] : ['stem.0', 'tip'];

        foreach ($required as $part) {
            $this->assertContains($part, $names, "{$slug}.vox has no {$part} part.");
        }
    }

    /**
     * The outliner names of a MagicaVoxel file's objects.
     *
     * @return list<string>
     */
    private function objectNames(string $path): array
    {
        $data = file_get_contents($path) ?: throw new RuntimeException("Cannot read {$path}");
        $offset = 20;
        $names = [];

        while ($offset < strlen($data)) {
            $id = substr($data, $offset, 4);
            $length = unpack('V', $data, $offset + 4)[1];
            $content = $offset + 12;

            if ($id === 'nTRN') {
                $cursor = $content + 4;
                $entries = unpack('V', $data, $cursor)[1];
                $cursor += 4;

                for ($i = 0; $i < $entries; $i++) {
                    $keyLength = unpack('V', $data, $cursor)[1];
                    $key = substr($data, $cursor + 4, $keyLength);
                    $cursor += 4 + $keyLength;
                    $valueLength = unpack('V', $data, $cursor)[1];
                    $value = substr($data, $cursor + 4, $valueLength);
                    $cursor += 4 + $valueLength;

                    if ($key === '_name') {
                        $names[] = $value;
                    }
                }
            }

            $offset = $content + $length;
        }

        return $names;
    }
}
