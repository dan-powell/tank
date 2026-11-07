<?php

namespace Tests\Feature;

use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    public function test_urls_use_the_scheme_and_host_forwarded_by_the_proxy(): void
    {
        $this->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Host' => 'tank.example.com',
            'X-Forwarded-Port' => '443',
        ])
            ->get('http://localhost/dashboard')
            ->assertRedirect('https://tank.example.com/login');
    }
}
