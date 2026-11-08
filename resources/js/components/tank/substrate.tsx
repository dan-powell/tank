import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, Vector3 } from 'three';
import type { Mesh } from 'three';
import { CELLS_PER_CM, VOXEL, worldToCell } from '@/lib/tank/space';
import { buildSubstrateGeometry } from '@/lib/tank/substrate-geometry';
import {
    applyBrush,
    heightAt,
    settleHeights,
} from '@/lib/tank/substrate-sculpt';
import type { SculptBrush } from '@/lib/tank/substrate-sculpt';
import type { TankGrid } from '@/types';
import { createCausticMaterial } from './caustics';

type Props = {
    grid: TankGrid;
    /** Saved substrate heights, in grid cells per heightmap column. */
    heights: number[];
    /** The sculpting brush, while sculpt mode is on. */
    brush: SculptBrush | null;
    /** Save a finished stroke. */
    onSculpt: (heights: number[]) => void;
    /** Called as a stroke starts and ends, so camera controls can stand aside. */
    onStrokeChange: (isStroking: boolean) => void;
};

/** Marks the gravel as somewhere things can be put down (see PlacementController). */
const PLACEABLE = { placeable: true };

type Stroke = {
    heights: Float32Array;
    /** Height Flatten levels towards: the gravel where the stroke began. */
    target: number;
    lastTime: number;
};

/**
 * The substrate, drawn from its heightmap. In sculpt mode a ring follows the
 * pointer, and dragging with the left button shapes the gravel under it; the
 * stroke is shown as it goes and handed on when the button is released.
 */
export function Substrate({
    grid,
    heights,
    brush,
    onSculpt,
    onStrokeChange,
}: Props) {
    const mesh = useRef<Mesh>(null);
    const stroke = useRef<Stroke | null>(null);
    const [draft, setDraft] = useState<number[] | null>(null);
    const [cursor, setCursor] = useState<Vector3 | null>(null);
    const scratch = useMemo(() => new Vector3(), []);

    const material = useMemo(
        () =>
            createCausticMaterial(new Color('#b49a72'), 1, {
                voxelGrain: true,
            }),
        [],
    );
    const shown = draft ?? heights;
    const shownKey = shown.join(',');
    const geometry = useMemo(
        () => buildSubstrateGeometry(grid, shownKey.split(',').map(Number)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [grid.width, grid.depth, grid.substrate_column, shownKey],
    );

    useEffect(() => () => material.dispose(), [material]);
    useEffect(() => () => geometry.dispose(), [geometry]);

    // A newly saved shape replaces the draft it came from.
    useEffect(() => {
        if (stroke.current === null) {
            setDraft(null);
        }
    }, [heights]);

    useEffect(() => {
        if (brush === null) {
            setCursor(null);
        }
    }, [brush]);

    const dab = (point: Vector3) => {
        const active = stroke.current;

        if (active === null || brush === null) {
            return;
        }

        const now = performance.now();
        const seconds = Math.min(0.1, (now - active.lastTime) / 1000);
        active.lastTime = now;

        const cell = worldToCell(point, scratch);
        applyBrush(
            grid,
            active.heights,
            brush,
            cell.x,
            cell.z,
            Math.max(seconds, 1 / 60),
            active.target,
        );
        setDraft(Array.from(active.heights));
    };

    const finish = () => {
        const active = stroke.current;

        if (active === null) {
            return;
        }

        stroke.current = null;
        onStrokeChange(false);
        onSculpt(settleHeights(grid, active.heights));
    };

    const handlers =
        brush === null
            ? {}
            : {
                  onPointerDown: (event: ThreeEvent<PointerEvent>) => {
                      if (event.button !== 0) {
                          return;
                      }

                      event.stopPropagation();
                      (event.target as Element).setPointerCapture?.(
                          event.pointerId,
                      );

                      const start = Float32Array.from(heights);
                      const cell = worldToCell(event.point, scratch);
                      stroke.current = {
                          heights: start,
                          target: heightAt(grid, start, cell.x, cell.z),
                          lastTime: performance.now(),
                      };
                      onStrokeChange(true);
                      dab(event.point);
                  },
                  onPointerMove: (event: ThreeEvent<PointerEvent>) => {
                      setCursor(event.point.clone());
                      dab(event.point);
                  },
                  onPointerUp: (event: ThreeEvent<PointerEvent>) => {
                      (event.target as Element).releasePointerCapture?.(
                          event.pointerId,
                      );
                      finish();
                  },
                  onPointerLeave: () => setCursor(null),
                  onLostPointerCapture: finish,
              };

    return (
        <>
            <mesh
                ref={mesh}
                geometry={geometry}
                material={material}
                userData={PLACEABLE}
                {...handlers}
            />
            {brush !== null && cursor !== null && (
                <mesh
                    position={[cursor.x, cursor.y + 0.004, cursor.z]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    raycast={() => null}
                >
                    <ringGeometry
                        args={[
                            brush.radiusCm * CELLS_PER_CM * VOXEL - 0.006,
                            brush.radiusCm * CELLS_PER_CM * VOXEL,
                            40,
                        ]}
                    />
                    <meshBasicMaterial
                        color="#7ee0c3"
                        transparent
                        opacity={0.85}
                        depthTest={false}
                    />
                </mesh>
            )}
        </>
    );
}
