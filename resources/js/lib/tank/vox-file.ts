/**
 * A minimal MagicaVoxel (.vox) reader and writer for the model scripts.
 *
 * Coordinates here are MagicaVoxel's own: x to the right, y away from the
 * viewer, z up. Each model keeps its outliner name (the `_name` of the
 * transform node above it), which the game reads as `stage.clip.frame` or a
 * plant part name.
 */

export type VoxModel = {
    name: string;
    /** [x, y, z] size in voxels (each at most 256). */
    size: [number, number, number];
    /** Packed x, y, z, colour index (1..255) per voxel. */
    voxels: number[];
};

export type VoxFile = {
    models: VoxModel[];
    /** 256 colours as 0xAABBGGRR, where palette[i - 1] is colour index i. */
    palette: number[];
};

/** Gap left between models when laying them out side by side in the editor. */
const LAYOUT_GAP = 4;

/** MagicaVoxel's default palette is used when a file has none; a plain grey ramp stands in. */
function defaultPalette(): number[] {
    return Array.from({ length: 256 }, (_, i) => {
        const v = 255 - i;

        return (0xff << 24) | (v << 16) | (v << 8) | v;
    });
}

export function readVox(bytes: Uint8Array): VoxFile {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (offset: number, length: number) =>
        String.fromCharCode(...bytes.subarray(offset, offset + length));

    if (text(0, 4) !== 'VOX ') {
        throw new Error('Not a MagicaVoxel file.');
    }

    const sizes: [number, number, number][] = [];
    const voxelLists: number[][] = [];
    const names = new Map<number, string>();
    const shapeChild = new Map<number, number>();
    const shapeModel = new Map<number, number>();
    let palette: number[] | null = null;
    let offset = 20;

    const readString = (at: number): [string, number] => {
        const length = view.getUint32(at, true);

        return [text(at + 4, length), at + 4 + length];
    };
    const readDict = (at: number): [Record<string, string>, number] => {
        const count = view.getUint32(at, true);
        const dict: Record<string, string> = {};
        let cursor = at + 4;

        for (let i = 0; i < count; i++) {
            const [key, afterKey] = readString(cursor);
            const [value, afterValue] = readString(afterKey);
            dict[key] = value;
            cursor = afterValue;
        }

        return [dict, cursor];
    };

    while (offset < bytes.length) {
        const id = text(offset, 4);
        const length = view.getUint32(offset + 4, true);
        const content = offset + 12;

        if (id === 'SIZE') {
            sizes.push([
                view.getUint32(content, true),
                view.getUint32(content + 4, true),
                view.getUint32(content + 8, true),
            ]);
        } else if (id === 'XYZI') {
            const count = view.getUint32(content, true);
            voxelLists.push(
                Array.from(
                    bytes.subarray(content + 4, content + 4 + count * 4),
                ),
            );
        } else if (id === 'RGBA') {
            palette = Array.from({ length: 256 }, (_, i) =>
                view.getUint32(content + i * 4, true),
            );
        } else if (id === 'nTRN') {
            const nodeId = view.getUint32(content, true);
            const [attributes, cursor] = readDict(content + 4);

            if (attributes._name !== undefined) {
                names.set(nodeId, attributes._name);
            }

            shapeChild.set(nodeId, view.getUint32(cursor, true));
        } else if (id === 'nSHP') {
            const nodeId = view.getUint32(content, true);
            const [, cursor] = readDict(content + 4);
            shapeModel.set(nodeId, view.getUint32(cursor + 4, true));
        }

        offset = content + length;
    }

    const modelNames = new Map<number, string>();

    for (const [transform, child] of shapeChild) {
        const model = shapeModel.get(child);
        const name = names.get(transform);

        if (model !== undefined && name !== undefined) {
            modelNames.set(model, name);
        }
    }

    return {
        models: sizes.map((size, index) => ({
            name: modelNames.get(index) ?? '',
            size,
            voxels: voxelLists[index] ?? [],
        })),
        palette: palette ?? defaultPalette(),
    };
}

export function writeVox(file: VoxFile): Uint8Array {
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();

    const chunk = (id: string, content: Uint8Array): Uint8Array => {
        const out = new Uint8Array(12 + content.length);
        const view = new DataView(out.buffer);
        out.set(encoder.encode(id), 0);
        view.setUint32(4, content.length, true);
        view.setUint32(8, 0, true);
        out.set(content, 12);

        return out;
    };
    const ints = (...values: number[]): Uint8Array => {
        const out = new Uint8Array(values.length * 4);
        const view = new DataView(out.buffer);
        values.forEach((value, i) => view.setInt32(i * 4, value, true));

        return out;
    };
    const dict = (entries: Record<string, string>): Uint8Array => {
        const parts: Uint8Array[] = [ints(Object.keys(entries).length)];

        for (const [key, value] of Object.entries(entries)) {
            for (const s of [key, value]) {
                const encoded = encoder.encode(s);
                parts.push(ints(encoded.length), encoded);
            }
        }

        return concat(parts);
    };

    for (const model of file.models) {
        const [x, y, z] = model.size;

        if (Math.max(x, y, z) > 256) {
            throw new Error(`Model "${model.name}" is larger than 256 voxels.`);
        }

        chunks.push(chunk('SIZE', ints(x, y, z)));
        chunks.push(
            chunk(
                'XYZI',
                concat([
                    ints(model.voxels.length / 4),
                    Uint8Array.from(model.voxels),
                ]),
            ),
        );
    }

    // Scene graph: root transform -> group -> one named transform + shape per model.
    const count = file.models.length;
    chunks.push(
        chunk(
            'nTRN',
            concat([ints(0), dict({}), ints(1, -1, -1, 1), dict({})]),
        ),
    );
    chunks.push(
        chunk(
            'nGRP',
            concat([
                ints(1),
                dict({}),
                ints(count, ...file.models.map((_, i) => 2 + i * 2)),
            ]),
        ),
    );

    let cursorX = 0;

    file.models.forEach((model, i) => {
        const [sx, sy, sz] = model.size;
        const translation = `${Math.round(cursorX + sx / 2)} ${Math.round(sy / 2)} ${Math.round(sz / 2)}`;
        cursorX += sx + LAYOUT_GAP;
        chunks.push(
            chunk(
                'nTRN',
                concat([
                    ints(2 + i * 2),
                    dict(model.name === '' ? {} : { _name: model.name }),
                    ints(3 + i * 2, -1, 0, 1),
                    dict({ _t: translation }),
                ]),
            ),
        );
        chunks.push(
            chunk(
                'nSHP',
                concat([ints(3 + i * 2), dict({}), ints(1, i), dict({})]),
            ),
        );
    });

    chunks.push(chunk('RGBA', ints(...file.palette.slice(0, 256))));

    const children = concat(chunks);
    const header = new Uint8Array(20);
    const view = new DataView(header.buffer);
    header.set(encoder.encode('VOX '), 0);
    view.setUint32(4, 150, true);
    header.set(encoder.encode('MAIN'), 8);
    view.setUint32(12, 0, true);
    view.setUint32(16, children.length, true);

    return concat([header, children]);
}

function concat(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(
        parts.reduce((sum, part) => sum + part.length, 0),
    );
    let offset = 0;

    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }

    return out;
}
