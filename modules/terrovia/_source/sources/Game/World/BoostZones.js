import { Game } from '../Game.js'

/**
 * DecFreedom - Zonas de velocidad INVISIBLES.
 * Cuando el carro pasa por una zona, acelera de verdad (reusa el turbo del carro,
 * player.boosting) y ademas sale el efecto bonito de boost. NO pintan nada en el piso.
 *
 * IMPORTANTE (fix): este update corre en el tick 1, DESPUES de Player.updatePrePhysics
 * (que resetea boosting) y ANTES de PhysicsVehicle.updatePrePhysics (tick 2, que lee
 * boosting para calcular la fuerza del motor). Antes corria en el tick 2 y llegaba
 * tarde: se veia el efecto pero no aceleraba.
 *
 * Posiciones: las marcadas por el usuario en el circuito. Faciles de mover: edita
 * this.zones (x, z del mundo; radius = radio).
 */
export class BoostZones
{
    constructor()
    {
        this.game = Game.getInstance()

        this.strength = 0.6                  // turbo moderado pero real (0 = nada, 1 = completo)
        this.zones = [
            { x: -15.4, z: -65.7, radius: 10 },
            { x: -38.5, z: -53.8, radius: 10 },
            { x: -27.6, z: -27.0, radius: 10 },
            { x: -38.5, z:  -4.2, radius: 10 },
            { x: -39.3, z:  67.0, radius: 10 },
        ]
        for(const z of this.zones)
            z.r2 = z.radius * z.radius

        this.active = false

        this.update = this.update.bind(this)
        // tick 1: despues de Player.updatePrePhysics (resetea boosting) y antes del
        // vehiculo (tick 2, que lo lee). Player se registra antes, asi que corre primero.
        this.game.ticker.events.on('tick', this.update, 1)
    }

    update()
    {
        const player = this.game.player
        if(!player || player.state !== 1)
        {
            this.active = false
            return
        }

        const p = player.position
        let inside = false

        for(const z of this.zones)
        {
            const dx = p.x - z.x
            const dz = p.z - z.z
            if(dx * dx + dz * dz <= z.r2)
            {
                inside = true
                break
            }
        }

        this.active = inside

        if(inside)
            player.boosting = Math.max(player.boosting, this.strength)
    }
}
