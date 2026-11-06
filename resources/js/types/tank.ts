export type Vector3Tuple = [number, number, number];

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
    root: Vector3Tuple;
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
        center: Vector3Tuple;
        radius: number;
    };
};

export type TankSnapshot = {
    id: number;
    name: string;
    volume_litres: number;
    water: WaterParameters;
    light_on: boolean;
    is_lit: boolean;
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
