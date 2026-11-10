import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * DecFreedom - Jefe (Boss).
 *
 * Monstruo 1 (Warrok): modelo con esqueleto + 15 animaciones (hechas en Mixamo y unidas
 * en un solo GLB). Aparece en el altar (el pentagrama de fuego rojo) y es SOLIDO: lleva
 * un cuerpo fisico para que los disparos le peguen y ocupe espacio.
 *
 * Por ahora solo aparece y hace su animacion de reposo (idle). El combate, la IA y el
 * resto de animaciones (embestida, lanzar biyudama, morir, etc.) se conectan despues:
 * ya estan todas dentro del modelo, listas para usar por nombre.
 */
export class Boss
{
    constructor()
    {
        this.game = Game.getInstance()

        this.placed = false
        this.scale = 2.2
        this.mixer = null
        this.actions = {}

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 8)
    }

    place()
    {
        const gltf = this.game.resources.monster1
        const altar = this.game.world.areas?.altar

        // esperar a que el modelo y el altar existan
        if(!gltf || !altar)
            return

        const pos = altar.position

        // ---- visual ----
        this.model = gltf.scene

        // escalar a una altura objetivo (robusto ante las unidades del modelo)
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3())
        const targetHeight = 5.2
        const s = targetHeight / (size.y || 1)
        this.scale = s
        this.size = size

        this.model.scale.setScalar(s)
        this.model.position.set(pos.x, pos.y - box.min.y * s, pos.z)
        this.model.rotation.y = Math.PI
        this.model.traverse((child) =>
        {
            if(child.isMesh || child.isSkinnedMesh)
            {
                child.castShadow = true
                child.frustumCulled = false
            }
        })
        this.game.scene.add(this.model)

        // ---- animaciones ----
        this.mixer = new THREE.AnimationMixer(this.model)
        for(const clip of gltf.animations)
            this.actions[clip.name] = this.mixer.clipAction(clip)

        const idle = this.actions.idle || this.mixer.clipAction(gltf.animations[0])
        if(idle)
            idle.play()

        // ---- fisica (solido: los disparos le pegan) ----
        const halfW = Math.max(size.x, size.z) * s * 0.28
        const halfH = size.y * s * 0.5
        this.obj = this.game.objects.add(null, {
            type: 'fixed',
            position: { x: pos.x, y: pos.y + halfH, z: pos.z },
            colliders: [ { shape: 'cuboid', parameters: [ halfW, halfH, halfW ], category: 'object' } ]
        })

        this.placed = true
    }

    // reproducir una animacion por nombre (para el combate mas adelante)
    play(name, { loop = true, fade = 0.2 } = {})
    {
        if(!this.mixer || !this.actions[name])
            return
        const action = this.actions[name]
        action.reset()
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
        action.clampWhenFinished = !loop
        action.fadeIn(fade).play()
        return action
    }

    update()
    {
        if(!this.placed)
            this.place()

        if(this.mixer)
            this.mixer.update(this.game.ticker.delta)
    }
}
