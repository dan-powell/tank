<?php

namespace App\Notifications;

use App\Enums\TankEventType;
use App\Models\Tank;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tell a tank's owner that its water or air has gone out of balance, or that
 * an animal is close to death and the tank has paused.
 */
class TankAlert extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  TankEventType  $type  Warning or NearDeath.
     * @param  string|null  $parameter  The warning's parameter (see AlertSettings::parameters()).
     */
    public function __construct(
        public Tank $tank,
        public TankEventType $type,
        public string $message,
        public ?string $parameter = null,
        public bool $sendMail = false,
        public bool $showInBrowser = false,
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return $this->sendMail ? ['database', 'broadcast', 'mail'] : ['database', 'broadcast'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->tank->name}: {$this->title()}")
            ->line($this->message)
            ->action('Open the tank', route('tanks.show', $this->tank));
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            ...$this->toArray($notifiable),
            'browser' => $this->showInBrowser,
        ]);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array{tank_id: int, tank_name: string, type: string, parameter: string|null, title: string, message: string, url: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'tank_id' => $this->tank->id,
            'tank_name' => $this->tank->name,
            'type' => $this->type->value,
            'parameter' => $this->parameter,
            'title' => $this->title(),
            'message' => $this->message,
            'url' => route('tanks.show', $this->tank, absolute: false),
        ];
    }

    private function title(): string
    {
        return $this->type === TankEventType::NearDeath ? 'Paused to save a dying animal' : 'Out of balance';
    }
}
