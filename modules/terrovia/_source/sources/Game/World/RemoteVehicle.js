import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * DecFreedom - Carro de OTRO jugador (multijugador P2P).
 *
 * Visual: clono el chasis ya montado del carro local y le cambio la pintura al color
 * del jugador (reuso la paleta por jugador de VisualVehicle).
 *
 * Fisica: un cuerpo KINEMATICO (caja) que muevo a la posicion de red cada frame. Asi
 * el carro remoto es SOLIDO en tu mundo: tus disparos le pegan y el empuja el entorno
 * (letras, cajas) por donde pasa. No lo mueven las fuerzas (su movimiento manda desde
 * su propio navegador), solo la red.
 */
export class RemoteVehicle
{
    constructor(id, colorName)
    {
        this.game = Game.getInstance()
        this.id = id

        // ---- visual ----
        const vv = this.game.world.visualVehicle
        this.group = vv.parts.chassis.clone(true)

        const paint = vv.paints.choices['player_' + colorName] || vv.paints.choices.player_blue || vv.paints.choices.red
        if(paint)
        {
            this.group.traverse((child) =>
            {
                if(child.isMesh && /^(bodyPainted|wheelPainted)/i.test(child.name))
                    child.material = paint
            })
        }

        this.group.position.set(0, -200, 0)
        this.game.scene.add(this.group)

        // ---- fisica (cuerpo kinematico) ----
        this.obj = this.game.objects.add(null, {
            type: 'kinematicPositionBased',
            position: { x: 0, y: -200, z: 0 },
            colliders: [ { shape: 'cuboid', parameters: [ 1.3, 0.55, 0.85 ], category: 'object' } ]
        })
        this.body = this.obj?.physical?.body || null

        // ---- interpolacion ----
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

        if(this.body)
        {
            this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z })
            this.body.setNextKinematicRotation({ x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w })
        }
    }

    destroy()
    {
        this.group.removeFromParent()
        if(this.obj)
        {
            try { this.game.objects.disable(this.obj) } catch(e) {}
        }
    }
}
