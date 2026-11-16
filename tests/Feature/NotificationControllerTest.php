<?php

namespace Tests\Feature;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Models\User;
use App\Notifications\TankAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_the_users_notifications_with_the_unread_count(): void
    {
        $tank = Tank::factory()->create(['name' => 'Reef']);
        $tank->user->notifyNow(new TankAlert($tank, TankEventType::Warning, 'Nitrate is too high.', 'nitrate'), ['database']);

        $this->actingAs($tank->user)
            ->getJson(route('notifications.index'))
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('notifications.0.data.tank_name', 'Reef')
            ->assertJsonPath('notifications.0.data.message', 'Nitrate is too high.')
            ->assertJsonPath('notifications.0.read_at', null);
    }

    public function test_marking_all_as_read(): void
    {
        $tank = Tank::factory()->create();
        $tank->user->notifyNow(new TankAlert($tank, TankEventType::Warning, 'Nitrate is too high.', 'nitrate'), ['database']);

        $this->actingAs($tank->user)
            ->post(route('notifications.read-all'))
            ->assertRedirect();

        $this->assertSame(0, $tank->user->unreadNotifications()->count());
    }

    public function test_cannot_mark_another_users_notification_as_read(): void
    {
        $tank = Tank::factory()->create();
        $tank->user->notifyNow(new TankAlert($tank, TankEventType::Warning, 'Nitrate is too high.', 'nitrate'), ['database']);
        $notification = $tank->user->notifications()->sole();

        $this->actingAs(User::factory()->create())
            ->post(route('notifications.read', $notification->id))
            ->assertNotFound();

        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_guests_cannot_list_notifications(): void
    {
        $this->getJson(route('notifications.index'))->assertUnauthorized();
    }
}
