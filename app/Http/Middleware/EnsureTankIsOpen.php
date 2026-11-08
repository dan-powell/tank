<?php

namespace App\Http\Middleware;

use App\Models\Tank;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuse hands-in work (feeding, maintenance, stocking, aquascaping) while
 * the tank's lid is sealed.
 */
class EnsureTankIsOpen
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     *
     * @throws ValidationException
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tank = $request->route('tank');

        if ($tank instanceof Tank && $tank->is_sealed) {
            throw ValidationException::withMessages(['lid' => __('Lift the lid first.')]);
        }

        return $next($request);
    }
}
