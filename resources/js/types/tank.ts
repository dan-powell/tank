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

export type PlantSnapshot = {
    id: number;
    species_id: number;
    root: PlanePoint;
    /** Depth layer, 0 = back glass. */
    layer: number;
    size: number;
    segments: number;
    health: number;
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

export type AutoFeeder = {
    feeds_per_day: 1 | 2 | 3;
    /** Simulated hours of the day (0-23) at which it feeds. */
    feed_hours: number[];
    unlimited: boolean;
    /** Portions left in the hopper (ignored in unlimited mode). */
    portions: number;
    capacity: number;
};

export type TankSnapshot = {
    id: number;
    name: string;
    volume_litres: number;
    /** Number of depth layers the tank is divided into. */
    layer_count: number;
    water: WaterParameters;
    light_on: boolean;
    is_lit: boolean;
    auto_feeder: AutoFeeder | null;
    sim_tick: number;
    sim_seconds: number;
    last_simulated_at: string | null;
    plants: PlantSnapshot[];
    creatures: CreatureSnapshot[];
};

export type SpeciesBehaviour =
    | 'ribbon'
    | 'whorl'
    | 'swimmer'
    | 'bottom_dweller'
    | 'crawler';

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
    kind: 'plant' | 'fish' | 'invertebrate';
    name: string;
    scientific_name: string | null;
    behaviour: SpeciesBehaviour;
    description: string | null;
    adult_size: number | null;
    max_size: number | null;
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
    | 'vacuum'
    | 'algae_scrub'
    | 'light_toggled'
    | 'livestock_added'
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
    creatures_count: number;
    plants_count: number;
    temperature: number;
    ammonia: number;
    nitrate: number;
};
