import * as THREE from 'three/webgpu'
import { Fn, texture, vec3, vec4, add, color, positionGeometry, normalGeometry, positionWorld, normalWorld, cameraPosition } from 'three/tsl'
import { Game } from '../Game.js'

/**
 * DecFreedom - Armas del carro.
 *
 * Disparo desde el CENTRO del frente del carro.
 *
 * Colisiones por RAYCAST (no por fisica): cada frame se lanza un rayo desde la
 * posicion anterior del proyectil hasta la nueva. Asi pega SIEMPRE con el primer
 * objeto que encuentra y se DETIENE ahi. No atraviesa nada y no depende de umbrales
 * de fuerza de contacto. Al impactar llama a fireballs.create (la MISMA explosion de
 * las cajas: bola de fuego + empuje a todo lo movible alrededor).
 *
 * Disparo cargado = BIYUDAMA (bomba de bestia con cola, Naruto):
 *   - Tocar Q: tiro normal (bola de energia chica).
 *   - MANTENER Q: se forma una esfera NEGRA y densa en el centro del carro que CRECE
 *     (con limite) mientras ABSORBE energia del ambiente (particulas que giran hacia
 *     el centro). La superficie tiene vetas de energia (ruido) y un halo oscuro.
 *   - Soltar: se dispara esa misma bola, vuela y al impactar explota en grande.
 *
 * La esfera usa el pipeline real del juego (TSL + ruido perlin + bloom), igual que las
 * bolas de fuego, para que se vea a la altura.
 */
export class Weapons
{
    constructor()
    {
        this.game = Game.getInstance()

        // disparo
        this.cooldown = 0
        this.shootInterval = 0.14
        this.projectileSpeed = 34
        this.maxRange = 240

        // normal / cargado al maximo (con LIMITE de tamano)
        this.normal  = { radius: 0.32, fireRadius: 2.2, explodeRadius: 5 }
        this.charged = { radius: 0.95, fireRadius: 6.5, explodeRadius: 12 }

        // carga (Biyudama)
        this.tapThreshold = 0.16
        this.maxChargeTime = 1.4
        this.charging = false
        this.chargeTime = 0
        this.chargeBall = null          // { group, core, particles[] }
        this.wasShootActive = false

        this.projectiles = []

        this.sphere = new THREE.SphereGeometry(1, 24, 24)
        this.particleGeometry = new THREE.SphereGeometry(1, 8, 8)
        this.particleMaterial = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#bfe4ff').multiplyScalar(3), transparent: true })

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

    canShoot()
    {
        return this.game.player?.state === 1 && this.game.reveal?.step >= 2
    }

    frontCenter(distance = 2.2, height = -0.3)
    {
        const v = this.game.physicalVehicle
        const fwd = this._f ? this._f.copy(v.forward) : (this._f = v.forward.clone())
        fwd.y = 0
        if(fwd.lengthSq() < 0.0001) fwd.set(1, 0, 0)
        fwd.normalize()
        const base = v.position
        return {
            origin: new THREE.Vector3(base.x + fwd.x * distance, base.y + height, base.z + fwd.z * distance),
            dir: fwd.clone()
        }
    }

    weaponColor()
    {
        try {
            const paint = this.game.world.visualVehicle?.paints?.current
            if(paint && paint.colorA) return new THREE.Color(paint.colorA)
        } catch(e) {}
        return new THREE.Color('#9fd0ff')
    }

    // ---- material de la Biyudama: esfera NEGRA densa con vetas de energia + halo ----
    bijudamaCore()
    {
        const perlin = this.game.noises.perlin
        const material = new THREE.MeshBasicNodeMaterial()
        material.outputNode = Fn(() =>
        {
            // ruido triplanar (como las bolas de fuego) para las vetas de energia
            const nUvX = positionGeometry.yz.mul(1.4)
            const nUvY = positionGeometry.xz.mul(1.4).add(0.7)
            const nUvZ = positionGeometry.xy.mul(1.4).add(1.4)
            const nX = texture(perlin, nUvX, 1).r
            const nY = texture(perlin, nUvY, 1).r
            const nZ = texture(perlin, nUvZ, 1).r

            const blend = normalGeometry.abs().normalize().toVar()
            blend.assign(blend.div(blend.x.add(blend.y).add(blend.z)))
            const noise = add(nX.mul(blend.x), nY.mul(blend.y), nZ.mul(blend.z)).toVar()

            // vetas: solo las zonas de ruido alto brillan (el resto queda NEGRO)
            const veins = noise.remap(0.58, 0.82, 0, 1).clamp(0, 1)

            // halo de borde (fresnel): energia oscura en el contorno
            const viewDir = cameraPosition.sub(positionWorld).normalize()
            const fres = normalWorld.dot(viewDir).oneMinus().clamp(0, 1).pow(2.4)

            // colores oscuros (violeta/indigo profundo); base NEGRA
            const veinColor = color('#3a0ca3').mul(veins).mul(2.2)
            const rimColor  = color('#5b21b6').mul(fres).mul(1.25)

            return vec4(veinColor.add(rimColor), 1)
        })()

        const mesh = new THREE.Mesh(this.sphere, material)
        return mesh
    }

    // ---- carga ----
    startCharge()
    {
        this.charging = true
        this.chargeTime = 0

        const group = new THREE.Group()
        const core = this.bijudamaCore()
        group.add(core)

        // particulas de energia que seran absorbidas hacia el centro
        const particles = []
        const count = 26
        for(let i = 0; i < count; i++)
        {
            const mesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial)
            const p = { mesh, dir: new THREE.Vector3(), dist: 0 }
            this.resetParticle(p)
            group.add(mesh)
            particles.push(p)
        }

        this.game.scene.add(group)
        this.chargeBall = { group, core, particles }
    }

    resetParticle(p)
    {
        // direccion aleatoria en la esfera + distancia exterior
        const u = Math.random() * 2 - 1
        const a = Math.random() * Math.PI * 2
        const s = Math.sqrt(1 - u * u)
        p.dir.set(s * Math.cos(a), u, s * Math.sin(a))
        p.dist = 2.2 + Math.random() * 2.2
    }

    updateChargeBall(delta)
    {
        if(!this.chargeBall) return
        const t = Math.min(this.chargeTime / this.maxChargeTime, 1)
        const radius = THREE.MathUtils.lerp(this.normal.radius, this.charged.radius, t)

        const fc = this.frontCenter(2.4, -0.05)
        const g = this.chargeBall.group
        g.position.copy(fc.origin)

        // el nucleo crece (se comprime la energia) y gira
        this.chargeBall.core.scale.setScalar(radius)
        this.chargeBall.core.rotation.y += delta * 1.2
        this.chargeBall.core.rotation.x += delta * 0.6

        // particulas: giran y son absorbidas hacia el centro
        const absorbR = radius * 0.9
        for(const p of this.chargeBall.particles)
        {
            // espiral: rotar la direccion alrededor del eje Y
            const ang = delta * 2.4
            const cos = Math.cos(ang), sin = Math.sin(ang)
            const dx = p.dir.x * cos - p.dir.z * sin
            const dz = p.dir.x * sin + p.dir.z * cos
            p.dir.x = dx; p.dir.z = dz

            p.dist -= delta * (1.6 + t * 1.8)
            if(p.dist <= absorbR)
                this.resetParticle(p)

            const scale = THREE.MathUtils.clamp((p.dist - absorbR) * 0.18, 0.015, 0.09) * (0.6 + t)
            p.mesh.position.copy(p.dir).multiplyScalar(p.dist)
            p.mesh.scale.setScalar(scale)
        }
    }

    removeChargeBall()
    {
        if(this.chargeBall)
        {
            this.chargeBall.core.material.dispose?.()
            this.chargeBall.group.removeFromParent()
            this.chargeBall = null
        }
    }

    cancelCharge()
    {
        this.removeChargeBall()
        this.charging = false
        this.chargeTime = 0
    }

    releaseCharge()
    {
        const held = this.chargeTime
        this.removeChargeBall()
        this.charging = false

        if(!this.canShoot()) return

        const t = held < this.tapThreshold ? 0 : Math.min(held / this.maxChargeTime, 1)
        this.fire(t)
    }

    // t = 0 (normal) .. 1 (cargado al maximo)
    fire(t)
    {
        const fc = this.frontCenter(2.2, -0.3)
        const radius = THREE.MathUtils.lerp(this.normal.radius, this.charged.radius, t)
        const fireRadius = THREE.MathUtils.lerp(this.normal.fireRadius, this.charged.fireRadius, t)
        const explodeRadius = THREE.MathUtils.lerp(this.normal.explodeRadius, this.charged.explodeRadius, t)
        const speed = THREE.MathUtils.lerp(this.projectileSpeed, this.projectileSpeed * 0.82, t)

        const carVel = this.game.physicalVehicle.chassis?.physical?.body?.linvel?.() || { x: 0, z: 0 }
        const vel = new THREE.Vector3(fc.dir.x * speed + carVel.x * 0.3, 0, fc.dir.z * speed + carVel.z * 0.3)
        const dir = vel.clone().normalize()

        this.spawnProjectile(fc.origin, dir, vel.length(), { radius, fireRadius, explodeRadius, charged: t > 0.001 })
    }

    spawnProjectile(origin, dir, speed, opts)
    {
        let group, core = null
        if(opts.charged)
        {
            // la MISMA bola negra (una sola, limpia) que vuela
            group = new THREE.Group()
            core = this.bijudamaCore()
            group.add(core)
            group.scale.setScalar(opts.radius)
        }
        else
        {
            // tiro normal: bola de energia brillante
            const col = this.weaponColor().multiplyScalar(3)
            group = new THREE.Mesh(this.sphere, new THREE.MeshBasicNodeMaterial({ color: col }))
            group.scale.setScalar(opts.radius)
        }
        group.position.copy(origin)
        this.game.scene.add(group)

        this.projectiles.push({
            pos: origin.clone(),
            dir: dir.clone(),
            speed,
            radius: opts.radius,
            fireRadius: opts.fireRadius,
            explodeRadius: opts.explodeRadius,
            charged: opts.charged,
            core,
            traveled: 0,
            group
        })
    }

    castSegment(from, dir, distance)
    {
        const world = this.game.physics.world
        const shooterBody = this.game.physicalVehicle?.chassis?.physical?.body
        const ray = new this.game.RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z })
        const hit = world.castRay(ray, distance, true, undefined, undefined, undefined, shooterBody, undefined)
        if(!hit) return null
        const toi = typeof hit.timeOfImpact === 'number' ? hit.timeOfImpact : hit.toi
        if(typeof toi !== 'number' || toi > distance) return null
        return toi
    }

    detonate(proj, at)
    {
        // MISMA explosion de las cajas: bola de fuego + empuje a todo lo movible
        this.game.world.fireballs.create(new THREE.Vector3(at.x, at.y, at.z), proj.fireRadius, proj.explodeRadius)
        this.cleanup(proj)
    }

    cleanup(proj)
    {
        if(proj.group)
        {
            if(proj.core) proj.core.material.dispose?.()
            else if(proj.group.material) proj.group.material.dispose?.()
            proj.group.removeFromParent()
        }
        const i = this.projectiles.indexOf(proj)
        if(i !== -1) this.projectiles.splice(i, 1)
    }

    update()
    {
        const delta = this.game.ticker.delta
        const shoot = this.game.inputs.actions.get('shoot')
        const active = !!shoot?.active
        const driving = this.game.player?.state === 1

        // ---- maquina de carga ----
        if(active && !this.wasShootActive && this.cooldown <= 0 && !this.charging && driving)
            this.startCharge()

        if(this.charging)
        {
            if(!driving)
                this.cancelCharge()
            else if(active)
            {
                this.chargeTime = Math.min(this.chargeTime + delta, this.maxChargeTime)
                this.updateChargeBall(delta)
            }
            else
            {
                this.releaseCharge()
                this.cooldown = this.shootInterval
            }
        }
        this.wasShootActive = active
        this.cooldown -= delta

        // ---- proyectiles ----
        for(let i = this.projectiles.length - 1; i >= 0; i--)
        {
            const proj = this.projectiles[i]
            const step = proj.speed * delta
            const reach = step + proj.radius

            const toi = this.castSegment(proj.pos, proj.dir, reach)
            if(toi !== null)
            {
                const at = proj.pos.clone().addScaledVector(proj.dir, Math.max(0, toi - proj.radius * 0.5))
                this.detonate(proj, at)
                continue
            }

            proj.pos.addScaledVector(proj.dir, step)
            proj.traveled += step
            proj.group.position.copy(proj.pos)
            if(proj.core)
            {
                proj.core.rotation.y += delta * 3
                proj.core.rotation.x += delta * 1.5
            }

            if(proj.traveled >= this.maxRange)
                this.detonate(proj, proj.pos)
        }
    }
}
