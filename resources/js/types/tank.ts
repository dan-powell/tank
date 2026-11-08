/** Normalised (0..1) x/y within a depth layer; y is height above the substrate. */
export type PlanePoint = [number, number];

export type WaterParameters = {
    temperature: number;
    target_temperature: number;
    ph: number;
    ammonia: number;
    nitrite: number;
    nitrate: number;
    oxygen: number;
    co2: number;
    detritus: number;
    uneaten_food: number;
    algae: number;
};

/** A decoration grid cell: x (left to right), y (up from the glass floor), z (back to front). */
export type GridCell = [number, number, number];

export type PlantSnapshot = {
    id: number;
    species_id: number;
    nickname: string | null;
    root: PlanePoint;
    /** Depth layer, 0 = back glass. */
    layer: number;
    /** Set when the plant grows from a decoration's anchor instead of the substrate. */
    attachment: { decoration_id: number; anchor: number } | null;
    size: number;
    segments: number;
    health: number;
    age_days: number;
};

export type CreatureSnapshot = {
    id: number;
    species_id: number;
    nickname: string | null;
    sex: 'male' | 'female';
    size: number;
    hunger: number;
    health: number;
    age_days: number;
    is_pregnant: boolean;
    generation: number;
    zone: {
        center: PlanePoint;
        /** Home depth layer, 0 = back glass. */
        layer: number;
        radius: number;
    };
};

/** A placed decoration; `position` is the minimum corner of its rotated box. */
export type DecorationSnapshot = {
    id: number;
    type: string;
    position: GridCell;
    /** Quarter turns about the vertical axis (0-3). */
    rotation: number;
    seed: number;
};

export type DecorationDefinition = {
    slug: string;
    name: string;
    description: string;
    /** `vox`: a MagicaVoxel file in resources/models/decor; `rock`: generated from the seed. */
    source: 'vox' | 'rock';
    /** Width, height and depth in grid cells, unrotated. */
    size: GridCell;
    /** Empty cells directly above solid voxels where plants can attach, unrotated. */
    anchors: GridCell[];
    params: {
        colors?: string[];
        roughness?: number;
        flatness?: number;
    };
};

/** The decoration grid (0.5 cm cells) shared by decorations, substrate and water. */
export type TankGrid = {
    width: number;
    height: number;
    depth: number;
    /** First cell row above the water (at or below the substrate when empty). */
    water_level: number;
    /** The highest water level the tank can be filled to. */
    max_water_level: number;
    /** Cells per side of one substrate heightmap column. */
    substrate_column: number;
};

/** The tank inhabitant or decoration picked out in the scene. */
export type TankSelection = {
    kind: 'creature' | 'plant' | 'decoration';
    id: number;
};

export type AutoFeeder = {
    feeds_per_day: 1 | 2 | 3;
    /** Simulated hours of the day (0-23) at which it feeds. */
    feed_hours: number[];
    unlimited: boolean;
    /** Portions left in the hopper (ignored in unlimited mode). */
    portions: number;
    capacity: number;
};

/** The backdrop behind the tank, as #rrggbb colours. */
export type TankBackground = {
    /** The whole backdrop, or the top of a gradient. */
    colour: string;
    /** The bottom of a gradient; null for a solid colour. */
    gradient_colour: string | null;
};

export type TankSnapshot = {
    id: number;
    name: string;
    volume_litres: number;
    /** Number of depth layers the tank is divided into. */
    layer_count: number;
    grid: TankGrid;
    /** False once the tank has been emptied. */
    has_water: boolean;
    /** Dry ground above the water, in square centimetres. */
    land_area_cm2: number;
    /** Whether the lid is sealed: the tank runs as its own ecosystem, hands off. */
    is_sealed: boolean;
    background: TankBackground;
    /** The air above the water: humidity %, oxygen % by volume, CO2 ppm. */
    air: { humidity: number; oxygen: number; co2: number };
    /** Substrate height in cells per heightmap column, row by row from the back glass. */
    substrate: number[];
    water: WaterParameters;
    light_on: boolean;
    is_lit: boolean;
    auto_feeder: AutoFeeder | null;
    sim_tick: number;
    sim_seconds: number;
    last_simulated_at: string | null;
    plants: PlantSnapshot[];
    creatures: CreatureSnapshot[];
    decorations: DecorationSnapshot[];
};

export type SpeciesBehaviour =
    | 'ribbon'
    | 'whorl'
    | 'cushion'
    | 'frond'
    | 'swimmer'
    | 'bottom_dweller'
    | 'crawler'
    | 'walker'
    | 'amphibian';

/** Where a species lives: in the water, at its edge, on land, or both. */
export type Habitat = 'aquatic' | 'emergent' | 'terrestrial' | 'amphibious';

export type SpeciesRender = {
    color?: string;
    segment_height?: number;
    blades?: number;
    body?: string;
    colorful_tail?: boolean;
    schooling?: number;
    speed?: number;
    /** 0..1 tendency to visit neighbouring depth layers. */
    layer_roam?: number;
    /** Maximum voxel thickness when a sprite has a depth map. */
    voxel_depth?: number;
    shell?: string;
    stripe?: string;
};

export type Species = {
    id: number;
    slug: string;
    kind: 'plant' | 'fish' | 'invertebrate' | 'amphibian';
    habitat: Habitat;
    name: string;
    scientific_name: string | null;
    behaviour: SpeciesBehaviour;
    description: string | null;
    adult_size: number | null;
    max_size: number | null;
    /** Where a plant can grow; null for animals. */
    anchorage: 'substrate' | 'decor' | 'any' | null;
    render: SpeciesRender;
};

export type TankEventType =
    | 'birth'
    | 'death'
    | 'plant_spread'
    | 'plant_died'
    | 'feeding'
    | 'auto_feeding'
    | 'auto_feeder_changed'
    | 'water_change'
    | 'water_level'
    | 'vacuum'
    | 'algae_scrub'
    | 'light_toggled'
    | 'lid'
    | 'livestock_added'
    | 'removed'
    | 'aquascaping'
    | 'warning';

export type TankEvent = {
    id: number;
    type: TankEventType;
    message: string;
    created_at: string | null;
};

export type TankUpdatedPayload = {
    tank_id: number;
    sim_tick: number;
    events: { type: TankEventType; message: string }[];
};

export type DashboardTank = {
    id: number;
    name: string;
    volume_litres: number;
    /** Interior width, height and depth in centimetres. */
    dimensions_cm: [number, number, number];
    background: TankBackground;
    creatures_count: number;
    plants_count: number;
    temperature: number;
    ammonia: number;
    nitrate: number;
};

/** Allowed interior sizes for a new tank, in whole centimetres: [min, max]. */
export type TankSizeLimits = {
    width: [number, number];
    height: [number, number];
    depth: [number, number];
};
