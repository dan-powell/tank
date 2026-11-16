<?php

namespace App\Simulation;

/**
 * A tank owner's alert preferences: which warnings to be told about, how they
 * are delivered, and which animals pause the tank when close to death.
 */
final readonly class AlertSettings
{
    public const float DEFAULT_NEAR_DEATH_HEALTH = 0.25;

    public const float MIN_NEAR_DEATH_HEALTH = 0.1;

    public const float MAX_NEAR_DEATH_HEALTH = 0.5;

    /**
     * @param  float  $nearDeathHealth  Health (0..1) below which a watched animal pauses the tank.
     * @param  list<string>  $disabledParameters  Warning parameters the owner does not want notifications for.
     * @param  list<int>  $watchedSpecies  Species whose animals pause the tank when close to death.
     * @param  bool  $mail  Whether notifications are also emailed.
     * @param  bool  $browser  Whether notifications are also shown by the browser.
     */
    public function __construct(
        public float $nearDeathHealth = self::DEFAULT_NEAR_DEATH_HEALTH,
        public array $disabledParameters = [],
        public array $watchedSpecies = [],
        public bool $mail = false,
        public bool $browser = false,
    ) {}

    /**
     * Every parameter the owner can be warned about, with readable names.
     *
     * @return array<string, string>
     */
    public static function parameters(): array
    {
        return [...BalanceLimits::LABELS, 'light' => 'Plant light'];
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public static function fromArray(array $settings): self
    {
        return new self(
            nearDeathHealth: (float) ($settings['near_death_health'] ?? self::DEFAULT_NEAR_DEATH_HEALTH),
            disabledParameters: array_values(array_map(strval(...), $settings['disabled_parameters'] ?? [])),
            watchedSpecies: array_values(array_map(intval(...), $settings['watched_species'] ?? [])),
            mail: (bool) ($settings['mail'] ?? false),
            browser: (bool) ($settings['browser'] ?? false),
        );
    }

    /**
     * @return array{near_death_health: float, disabled_parameters: list<string>, watched_species: list<int>, mail: bool, browser: bool}
     */
    public function toArray(): array
    {
        return [
            'near_death_health' => $this->nearDeathHealth,
            'disabled_parameters' => $this->disabledParameters,
            'watched_species' => $this->watchedSpecies,
            'mail' => $this->mail,
            'browser' => $this->browser,
        ];
    }

    /**
     * Whether the owner wants to be told when this parameter goes out of range.
     */
    public function notifiesAbout(string $parameter): bool
    {
        return ! in_array($parameter, $this->disabledParameters, true);
    }

    public function watchesSpecies(int $speciesId): bool
    {
        return in_array($speciesId, $this->watchedSpecies, true);
    }

    /**
     * A copy with the species added to or removed from the watch list.
     */
    public function withSpeciesWatched(int $speciesId, bool $watched): self
    {
        $species = array_values(array_diff($this->watchedSpecies, [$speciesId]));

        if ($watched) {
            $species[] = $speciesId;
            sort($species);
        }

        return new self($this->nearDeathHealth, $this->disabledParameters, $species, $this->mail, $this->browser);
    }
}
