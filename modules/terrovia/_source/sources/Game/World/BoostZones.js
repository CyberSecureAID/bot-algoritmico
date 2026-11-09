import { Game } from '../Game.js'

/**
 * DecFreedom - Zonas de velocidad INVISIBLES.
 * Cuando el carro pasa por encima de una zona, acelera un poco (turbo moderado)
 * reusando el turbo real del carro (player.boosting). NO pintan nada en el piso.
 *
 * Estan ancladas a rectas reales del circuito (posiciones de checkpoints, siempre
 * sobre el asfalto), lejos de los obstaculos. Son faciles de mover: edita this.zones
 * (x, z en coordenadas del mundo; radius = radio de la zona).
 */
export class BoostZones
{
    constructor()
    {
        this.game = Game.getInstance()

        this.strength = 0.5                 // turbo moderado (0 = nada, 1 = turbo completo)
        this.zones = [
            { x:  37.06, z: -47.82, radius: 8 },   // recta derecha (salida de curva)
            { x: -61.81, z: -27.47, radius: 8 },   // recta izquierda
            { x: -56.05, z:  70.52, radius: 8 },   // recta de abajo (salida de la horquilla)
        ]
        for(const z of this.zones)
            z.r2 = z.radius * z.radius

        this.active = false

        this.update = this.update.bind(this)
        // tick 2: despues de player.updatePrePhysics (1) y antes de la fisica (3)
        this.game.ticker.events.on('tick', this.update, 2)
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
