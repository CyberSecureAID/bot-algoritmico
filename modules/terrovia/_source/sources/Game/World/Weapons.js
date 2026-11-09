import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * DecFreedom - Armas del carro.
 * Dispara hacia ADELANTE desde las dos luces delanteras. El proyectil vuela recto,
 * choca con lo que tenga delante y EXPLOTA, empujando todo lo que se mueve
 * (bancos, cajas, letras, otros carros) reusando game.explosions.explode().
 * Pensado para tener variedad por carro (por ahora un tipo: bola de energia).
 */
export class Weapons
{
    constructor()
    {
        this.game = Game.getInstance()

        this.cooldown = 0
        this.shootInterval = 0.32          // seg entre disparos
        this.projectileSpeed = 32
        this.projectileLife = 1.8          // seg de vuelo maximo
        this.explodeRadius = 6
        this.explodeStrength = 8           // potente: mueve bancos, cajas, letras y carros
        this.projectiles = []
        this._side = 1                     // alterna luz izquierda/derecha

        this.color = new THREE.Color('#9fd0ff')
        this.geometry = new THREE.SphereGeometry(0.28, 12, 12)

        this.setInput()

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 6)
    }

    setInput()
    {
        try {
            this.game.inputs.addActions([
                { name: 'shoot', categories: [ 'wandering', 'racing' ], keys: [ 'Keyboard.KeyQ', 'Gamepad.r2' ] },
            ])
        } catch(e) {}
    }

    // color del arma = color del carro del jugador (si existe)
    weaponColor()
    {
        try {
            const paint = this.game.world.visualVehicle?.paints?.current
            if(paint && paint.colorA) return new THREE.Color(paint.colorA)
        } catch(e) {}
        return this.color
    }

    canShoot()
    {
        // solo cuando se controla el carro y el mundo ya abrio
        return this.game.player?.state === 1 && this.game.reveal?.step >= 2
    }

    shoot()
    {
        const v = this.game.physicalVehicle
        if(!v) return
        const fwd = this._tmpF ? this._tmpF.copy(v.forward) : (this._tmpF = v.forward.clone())
        fwd.y = 0
        if(fwd.lengthSq() < 0.001) return
        fwd.normalize()
        const right = this._tmpR ? this._tmpR.set(-fwd.z, 0, fwd.x) : (this._tmpR = new THREE.Vector3(-fwd.z, 0, fwd.x))

        const base = v.position
        const carVel = v.chassis?.physical?.body?.linvel?.() || { x: 0, y: 0, z: 0 }

        // alterna las dos luces delanteras
        this._side *= -1
        const sideSign = this._side

        const origin = new THREE.Vector3(
            base.x + fwd.x * 2.0 + right.x * 0.55 * sideSign,
            base.y + 0.35,
            base.z + fwd.z * 2.0 + right.z * 0.55 * sideSign
        )
        const vel = {
            x: fwd.x * this.projectileSpeed + carVel.x * 0.4,
            y: 0,
            z: fwd.z * this.projectileSpeed + carVel.z * 0.4
        }
        this.spawnProjectile(origin, vel)
    }

    spawnProjectile(origin, vel)
    {
        const col = this.weaponColor()

        // cuerpo fisico (bola) que vuela recto (sin gravedad) y avisa al chocar
        const proj = { life: this.projectileLife, hit: false, arm: 0.06 }
        const obj = this.game.objects.add(null, {
            type: 'dynamic',
            position: origin,
            mass: 0.4,
            linearDamping: 0,
            angularDamping: 0,
            colliders: [ { shape: 'ball', parameters: [ 0.26 ], category: 'object' } ],
            onCollision: () => { if(proj.arm <= 0) proj.hit = true }
        })
        const body = obj.physical.body
        body.setGravityScale(0, true)
        body.setLinvel(vel, true)

        // visual brillante (con bloom)
        const mat = new THREE.MeshBasicNodeMaterial({ color: col.clone().multiplyScalar(3) })
        const mesh = new THREE.Mesh(this.geometry, mat)
        mesh.position.copy(origin)
        mesh.castShadow = false
        this.game.scene.add(mesh)

        proj.obj = obj; proj.body = body; proj.mesh = mesh; proj.mat = mat
        this.projectiles.push(proj)
    }

    detonate(proj)
    {
        const p = proj.body.translation()
        const pos = new THREE.Vector3(p.x, p.y, p.z)
        // deshabilitar el proyectil antes de explotar (que no se empuje a si mismo)
        this.game.objects.disable(proj.obj)
        this.game.explosions.explode(pos, this.explodeRadius, this.explodeStrength)
        this.cleanup(proj)
    }

    cleanup(proj)
    {
        if(proj.mesh)
        {
            proj.mesh.removeFromParent()
            proj.mat.dispose?.()
        }
        try { this.game.objects.disable(proj.obj) } catch(e) {}
        const i = this.projectiles.indexOf(proj)
        if(i !== -1) this.projectiles.splice(i, 1)
    }

    update()
    {
        const delta = this.game.ticker.delta

        // disparo
        this.cooldown -= delta
        if(this.cooldown <= 0 && this.canShoot() && this.game.inputs.actions.get('shoot')?.active)
        {
            this.shoot()
            this.cooldown = this.shootInterval
        }

        // proyectiles
        for(let i = this.projectiles.length - 1; i >= 0; i--)
        {
            const proj = this.projectiles[i]
            proj.arm -= delta
            proj.life -= delta
            const t = proj.body.translation()
            proj.mesh.position.set(t.x, t.y, t.z)

            if(proj.hit || proj.life <= 0)
                this.detonate(proj)
        }
    }
}
