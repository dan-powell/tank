<?php

namespace App\Enums;

enum TankEventType: string
{
    case Birth = 'birth';
    case Death = 'death';
    case PlantSpread = 'plant_spread';
    case PlantDied = 'plant_died';
    case Feeding = 'feeding';
    case AutoFeeding = 'auto_feeding';
    case AutoFeederChanged = 'auto_feeder_changed';
    case WaterChange = 'water_change';
    case Vacuum = 'vacuum';
    case AlgaeScrub = 'algae_scrub';
    case LightToggled = 'light_toggled';
    case LivestockAdded = 'livestock_added';
    case Removed = 'removed';
    case Aquascaping = 'aquascaping';
    case Warning = 'warning';
}
