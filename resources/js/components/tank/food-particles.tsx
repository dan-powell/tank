import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import type { TankWorld } from '@/lib/tank/world';

const MAX_PARTICLES = 300;
const dummy = new Object3D();

/** Draws the client-side food particles as one instanced mesh. */
export function FoodParticles({ world }: { world: TankWorld }) {
    const mesh = useRef<InstancedMesh>(null);

    useFrame((_, delta) => {
        world.update(Math.min(delta, 0.05));

        if (mesh.current === null) {
            return;
        }

        world.food.slice(0, MAX_PARTICLES).forEach((particle, index) => {
            dummy.position.copy(particle.position);
            dummy.rotation.set(particle.id, particle.id * 0.5, 0);
            dummy.updateMatrix();
            mesh.current?.setMatrixAt(index, dummy.matrix);
        });
        mesh.current.count = Math.min(world.food.length, MAX_PARTICLES);
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={mesh}
            args={[undefined, undefined, MAX_PARTICLES]}
            frustumCulled={false}
        >
            <boxGeometry args={[0.012, 0.004, 0.012]} />
            <meshStandardMaterial color="#d9763a" roughness={0.9} />
        </instancedMesh>
    );
}
