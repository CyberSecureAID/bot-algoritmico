import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * DecFreedom - Carro de OTRO jugador (multijugador P2P).
 *
 * No tiene fisica: es visual puro, movido por los datos que llegan por la red
 * (posicion + rotacion), interpolados para que se vea fluido.
 *
 * Para que se vea identico al carro base, CLONO el chasis ya montado del carro local
 * (que ya tiene sus materiales), y solo le cambio la pintura al color del jugador
 * (reusando la paleta de colores por jugador que ya existe en VisualVehicle).
 */
export class RemoteVehicle
{
    constructor(id, colorName)
    {
        this.game = Game.getInstance()
        this.id = id

        const vv = this.game.world.visualVehicle
        this.group = vv.parts.chassis.clone(true)

        // color del jugador
        const paint = vv.paints.choices['player_' + colorName] || vv.paints.choices.player_blue || vv.paints.choices.red
        if(paint)
        {
            this.group.traverse((child) =>
            {
                if(child.isMesh && /^(bodyPainted|wheelPainted)/i.test(child.name))
                    child.material = paint
            })
        }

        // arranca fuera de vista hasta el primer dato
        this.group.position.set(0, -200, 0)
        this.game.scene.add(this.group)

        this.pos = new THREE.Vector3(0, -200, 0)
        this.quat = new THREE.Quaternion()
        this.targetPos = this.pos.clone()
        this.targetQuat = this.quat.clone()
        this.hasTarget = false
        this.lastUpdate = 0
    }

    setState(x, y, z, q)
    {
        this.targetPos.set(x, y, z)
        this.targetQuat.set(q[0], q[1], q[2], q[3])
        this.lastUpdate = this.game.ticker.elapsed

        // el primer dato se aplica de golpe (sin interpolar desde fuera de vista)
        if(!this.hasTarget)
        {
            this.pos.copy(this.targetPos)
            this.quat.copy(this.targetQuat)
            this.hasTarget = true
        }
    }

    update(delta)
    {
        if(!this.hasTarget)
            return

        const k = Math.min(1, delta * 12)
        this.pos.lerp(this.targetPos, k)
        this.quat.slerp(this.targetQuat, k)
        this.group.position.copy(this.pos)
        this.group.quaternion.copy(this.quat)
    }

    destroy()
    {
        this.group.removeFromParent()
    }
}
