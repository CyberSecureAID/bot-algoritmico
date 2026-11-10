import * as THREE from 'three/webgpu'
import { add, cameraPosition, color, Fn, normalGeometry, normalWorld, positionGeometry, positionWorld, texture, vec4 } from 'three/tsl'
import gsap from 'gsap'
import { Game } from '../Game.js'

/**
 * DecFreedom - Jefe (Boss) con motor de combate.
 *
 * Monstruo 1 (Warrok): aparece en el altar (pentagrama). Protege el lugar: si te acercas
 * y te ve (distancia + linea de vista; esconderte tras las rocas rompe el contacto), sale
 * y pelea; si te alejas o lo pierdes, regresa y se calma. NO te persigue por todo el mapa.
 *
 * Es KINEMATICO y con correa (leash): yo controlo su posicion sobre el suelo, asi nunca se
 * mete bajo el piso ni se traba. Sus proyectiles son el MISMO fuego rojo/negro del
 * pentagrama. Al pelear, el mapa se hace de noche y caen rayos; al calmarse, vuelve el dia.
 *
 * Vida: recibe tus Biyudamas (animaciones de golpe) y muere. Pensado para que ganarle
 * cueste. El combate no toca la Biyudama del jugador (Weapons) ni su fisica.
 */
export class Boss
{
    constructor()
    {
        this.game = Game.getInstance()

        this.placed = false
        this.state = 'guard'            // guard | emerge | fight | retreat | dead
        this.scale = 2.2
        this.mixer = null
        this.actions = {}
        this.current = null

        // vida
        this.maxHp = 40
        this.hp = this.maxHp

        // deteccion / correa
        this.detectRadius = 24
        this.loseRadius = 34
        this.emergeDist = 6
        this.loseTimer = 0
        this.loseAfter = 3.5

        // ataques
        this.attackCooldown = 1.2
        this.attackTimer = 1.5

        // proyectiles del jefe
        this.bossProjectiles = []
        this.sphere = new THREE.SphereGeometry(1, 20, 20)

        // movimiento controlado (lerp entre puntos, sin fisica)
        this.move = null

        // atmosfera / rayos
        this.battleOn = false
        this.lightningTimer = 0

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 8)
    }

    // ---------------------------------------------------------------- colocacion
    place()
    {
        const gltf = this.game.resources.monster1
        const altar = this.game.world.areas?.altar
        if(!gltf || !altar)
            return

        const pos = altar.position

        // visual: escalar a una altura objetivo (robusto ante las unidades del modelo)
        this.model = gltf.scene
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3())
        const s = 5.2 / (size.y || 1)
        this.scale = s
        this.size = size
        this.halfH = size.y * s * 0.5

        this.model.scale.setScalar(s)
        this.home = new THREE.Vector3(pos.x, pos.y - box.min.y * s, pos.z)
        this.model.position.copy(this.home)
        this.facingOffset = 0                 // mira de FRENTE (giro de 180 respecto a lo que estaba)
        this.model.traverse((c) =>
        {
            if(c.isMesh || c.isSkinnedMesh)
            {
                c.castShadow = true
                c.frustumCulled = false
            }
        })
        this.game.scene.add(this.model)

        // animaciones
        this.mixer = new THREE.AnimationMixer(this.model)
        for(const clip of gltf.animations)
            this.actions[clip.name] = this.mixer.clipAction(clip)
        this.play('idle')

        // fisica KINEMATICA (solido: los disparos le pegan, y la puedo mover)
        const halfW = Math.max(size.x, size.z) * s * 0.3
        this.obj = this.game.objects.add(null, {
            type: 'kinematicPositionBased',
            position: { x: this.home.x, y: this.home.y + this.halfH, z: this.home.z },
            colliders: [ { shape: 'cuboid', parameters: [ halfW, this.halfH, halfW ], category: 'object' } ]
        })
        this.body = this.obj?.physical?.body || null
        this.hitRadius = Math.max(halfW, 2.2)

        this.placed = true
    }

    // altura del suelo en (x,z) con un rayo hacia abajo (para no meterse bajo el piso)
    groundY(x, z, fallback)
    {
        try
        {
            const world = this.game.physics.world
            const ray = new this.game.RAPIER.Ray({ x, y: (fallback ?? 0) + 40, z }, { x: 0, y: -1, z: 0 })
            const hit = world.castRay(ray, 200, true, undefined, undefined, undefined, this.body || undefined, undefined)
            if(hit)
            {
                const toi = hit.timeOfImpact ?? hit.toi
                if(typeof toi === 'number')
                    return (fallback ?? 0) + 40 - toi
            }
        }
        catch(e) {}
        return fallback ?? 0
    }

    // ---------------------------------------------------------------- utilidades
    get playerPos()
    {
        return this.game.player?.position || new THREE.Vector3()
    }

    get playerBody()
    {
        return this.game.physicalVehicle?.chassis?.physical?.body || null
    }

    play(name, { loop = true, fade = 0.2 } = {})
    {
        const action = this.actions[name]
        if(!action)
            return null
        if(this.current === action && loop)
            return action
        action.reset()
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
        action.clampWhenFinished = !loop
        action.enabled = true
        action.fadeIn(fade).play()
        if(this.current && this.current !== action)
            this.current.fadeOut(fade)
        this.current = action
        return action
    }

    faceTo(target, delta, speed = 6)
    {
        const dx = target.x - this.model.position.x
        const dz = target.z - this.model.position.z
        if(dx * dx + dz * dz < 0.0001)
            return
        const wanted = Math.atan2(dx, dz) + this.facingOffset
        let cur = this.model.rotation.y
        let diff = wanted - cur
        while(diff > Math.PI) diff -= Math.PI * 2
        while(diff < -Math.PI) diff += Math.PI * 2
        this.model.rotation.y = cur + diff * Math.min(1, delta * speed)
    }

    distanceToPlayerFromHome()
    {
        const p = this.playerPos
        const dx = p.x - this.home.x
        const dz = p.z - this.home.z
        return Math.sqrt(dx * dx + dz * dz)
    }

    // linea de vista: si hay algo solido entre el jefe y el jugador, no lo ve
    losBlocked()
    {
        try
        {
            const from = new THREE.Vector3(this.model.position.x, this.model.position.y + this.halfH * 0.9, this.model.position.z)
            const p = this.playerPos
            const to = new THREE.Vector3(p.x, p.y + 0.8, p.z)
            const dir = to.clone().sub(from)
            const dist = dir.length()
            dir.normalize()
            const world = this.game.physics.world
            const ray = new this.game.RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z })
            const hit = world.castRay(ray, dist, true, undefined, undefined, undefined, this.body || undefined, undefined)
            if(!hit)
                return false
            const toi = hit.timeOfImpact ?? hit.toi
            return typeof toi === 'number' && toi < dist - 2.0   // algo solido en medio
        }
        catch(e)
        {
            return false
        }
    }

    // ---------------------------------------------------------------- estados
    setState(s)
    {
        if(this.state === s)
            return
        this.state = s

        if(s === 'emerge')
        {
            const p = this.playerPos
            const dir = new THREE.Vector3(p.x - this.home.x, 0, p.z - this.home.z)
            if(dir.lengthSq() < 0.001) dir.set(0, 0, 1)
            dir.normalize()
            const bx = this.home.x + dir.x * this.emergeDist
            const bz = this.home.z + dir.z * this.emergeDist
            const by = this.groundY(bx, bz, this.home.y)
            this.battlePos = new THREE.Vector3(bx, by, bz)
            this.startMove(this.home.clone(), this.battlePos.clone(), 1.1)
            this.play('roll_forward', { loop: false, fade: 0.15 })
            this.startBattle()
        }
        else if(s === 'fight')
        {
            this.play('idle')
            this.attackTimer = 0.6
        }
        else if(s === 'retreat')
        {
            this.startMove(this.model.position.clone(), this.home.clone(), 1.3)
            this.play('walk', { fade: 0.2 })
            this.endBattle()
        }
        else if(s === 'guard')
        {
            this.play('idle')
        }
        else if(s === 'dead')
        {
            this.play('death', { loop: false, fade: 0.1 })
            this.endBattle()
            if(this.body) { try { this.body.setEnabled(false) } catch(e) {} }
        }
    }

    startMove(from, to, duration)
    {
        this.move = { from, to, t: 0, duration }
    }

    // ---------------------------------------------------------------- batalla (atmosfera)
    startBattle()
    {
        if(this.battleOn)
            return
        this.battleOn = true
        // noche + pausar la musica normal (la musica de batalla se enchufa cuando haya pista)
        try { this.game.dayCycles.override.start({ progress: 0.47 }, 2.5) } catch(e) {}
        try { this.game.audio.playlist?.current?.sound?.pause?.() } catch(e) {}
    }

    endBattle()
    {
        if(!this.battleOn)
            return
        this.battleOn = false
        try { this.game.dayCycles.override.end(3) } catch(e) {}
        try { this.game.audio.playlist?.current?.sound?.play?.() } catch(e) {}
    }

    // ---------------------------------------------------------------- ataques
    chooseAttack()
    {
        const dist = this.playerPos.distanceTo(this.model.position)
        const r = Math.random()
        if(dist < 7 && r < 0.3)
            return 'clap'
        if(r < 0.2)
            return 'shockwave'
        if(r < 0.35 && dist < 16)
            return 'charge'
        return 'throw'
    }

    doAttack()
    {
        const kind = this.chooseAttack()

        if(kind === 'throw')
        {
            const anim = Math.random() < 0.5 ? 'throw_bijudama' : 'throw_combo'
            this.play(anim, { loop: false, fade: 0.12 })
            gsap.delayedCall(0.45, () => { if(this.state === 'fight') this.spawnBossProjectile() })
            this.attackTimer = 1.6
        }
        else if(kind === 'clap')
        {
            this.play('clap_attack', { loop: false, fade: 0.12 })
            gsap.delayedCall(0.5, () =>
            {
                if(this.state !== 'fight') return
                const f = this.frontPoint(3)
                try { this.game.world.fireballs.create(f, 3.5, 5) } catch(e) {}
            })
            this.attackTimer = 2.0
        }
        else if(kind === 'charge')
        {
            this.play('charge', { loop: false, fade: 0.12 })
            const p = this.playerPos
            const dir = new THREE.Vector3(p.x - this.model.position.x, 0, p.z - this.model.position.z).normalize()
            const toX = this.battlePos.x + dir.x * 4
            const toZ = this.battlePos.z + dir.z * 4
            const toY = this.groundY(toX, toZ, this.battlePos.y)
            const lungeTo = new THREE.Vector3(toX, toY, toZ)
            this.startMove(this.model.position.clone(), lungeTo, 0.5)
            gsap.delayedCall(0.55, () =>
            {
                if(this.state !== 'fight') return
                this.startMove(this.model.position.clone(), this.battlePos.clone(), 0.7)
            })
            this.attackTimer = 2.2
        }
        else if(kind === 'shockwave')
        {
            this.play('power_shockwave', { loop: false, fade: 0.12 })
            this.spawnChargeOrb()
            gsap.delayedCall(1.0, () =>
            {
                if(this.state !== 'fight') return
                this.releaseShockwave()
            })
            this.attackTimer = 2.8
        }
    }

    frontPoint(dist)
    {
        const yaw = this.model.rotation.y - this.facingOffset
        return new THREE.Vector3(
            this.model.position.x + Math.sin(yaw) * dist,
            this.model.position.y + this.halfH * 0.5,
            this.model.position.z + Math.cos(yaw) * dist
        )
    }

    // material de fuego rojo/negro (el del pentagrama)
    fireMaterial()
    {
        const perlin = this.game.noises.perlin
        const material = new THREE.MeshBasicNodeMaterial()
        material.outputNode = Fn(() =>
        {
            const nUvX = positionGeometry.yz.mul(1.4)
            const nUvY = positionGeometry.xz.mul(1.4).add(0.7)
            const nUvZ = positionGeometry.xy.mul(1.4).add(1.4)
            const nX = texture(perlin, nUvX, 1).r
            const nY = texture(perlin, nUvY, 1).r
            const nZ = texture(perlin, nUvZ, 1).r
            const blend = normalGeometry.abs().normalize().toVar()
            blend.assign(blend.div(blend.x.add(blend.y).add(blend.z)))
            const noise = add(nX.mul(blend.x), nY.mul(blend.y), nZ.mul(blend.z)).toVar()
            const veins = noise.remap(0.5, 0.8, 0, 1).clamp(0, 1)
            const viewDir = cameraPosition.sub(positionWorld).normalize()
            const fres = normalWorld.dot(viewDir).oneMinus().clamp(0, 1).pow(2.2)
            const veinColor = color('#ff3b24').mul(veins).mul(3.0)
            const rimColor = color('#ff544d').mul(fres).mul(2.0)
            return vec4(veinColor.add(rimColor), 1)
        })()
        return material
    }

    spawnBossProjectile()
    {
        const from = this.frontPoint(2.2)
        from.y = this.model.position.y + this.halfH * 1.05
        const p = this.playerPos
        const target = new THREE.Vector3(p.x, p.y + 0.6, p.z)
        const dir = target.clone().sub(from).normalize()

        const mesh = new THREE.Mesh(this.sphere, this.fireMaterial())
        mesh.scale.setScalar(0.8)
        mesh.position.copy(from)
        this.game.scene.add(mesh)

        this.bossProjectiles.push({ mesh, pos: from.clone(), dir, speed: 26, traveled: 0, radius: 0.8 })
    }

    spawnChargeOrb()
    {
        this.chargeOrb = new THREE.Mesh(this.sphere, this.fireMaterial())
        this.chargeOrb.scale.setScalar(0.1)
        this.game.scene.add(this.chargeOrb)
        gsap.to(this.chargeOrb.scale, { x: 2.2, y: 2.2, z: 2.2, duration: 0.95, ease: 'power2.in' })
    }

    releaseShockwave()
    {
        if(this.chargeOrb)
        {
            this.chargeOrb.material.dispose?.()
            this.chargeOrb.removeFromParent()
            this.chargeOrb = null
        }
        const center = new THREE.Vector3(this.model.position.x, this.model.position.y + 0.3, this.model.position.z)

        // onda expansiva visible (anillo rojo que crece y se desvanece)
        const ringMat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        ringMat.colorNode = color('#ff544d').mul(3)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 48), ringMat)
        ring.rotation.x = -Math.PI * 0.5
        ring.position.copy(center)
        this.game.scene.add(ring)
        const s = { v: 1 }
        gsap.to(s, { v: 16, duration: 0.6, ease: 'power2.out', onUpdate: () => ring.scale.setScalar(s.v) })
        gsap.to(ringMat, { opacity: 0, duration: 0.6, ease: 'power1.in', onComplete: () =>
        {
            ringMat.dispose?.()
            ring.geometry.dispose()
            ring.removeFromParent()
        } })

        // empuje real (reusa la explosion del juego)
        try { this.game.world.fireballs.create(center, 5, 10) } catch(e) {}
    }

    updateBossProjectiles(delta)
    {
        for(let i = this.bossProjectiles.length - 1; i >= 0; i--)
        {
            const pr = this.bossProjectiles[i]
            const step = pr.speed * delta
            let hit = null
            try
            {
                const world = this.game.physics.world
                const ray = new this.game.RAPIER.Ray({ x: pr.pos.x, y: pr.pos.y, z: pr.pos.z }, { x: pr.dir.x, y: pr.dir.y, z: pr.dir.z })
                const h = world.castRay(ray, step + pr.radius, true, undefined, undefined, undefined, this.body || undefined, undefined)
                if(h)
                {
                    const toi = h.timeOfImpact ?? h.toi
                    if(typeof toi === 'number') hit = toi
                }
            }
            catch(e) {}

            if(hit !== null)
            {
                const at = pr.pos.clone().addScaledVector(pr.dir, Math.max(0, hit - pr.radius * 0.5))
                try { this.game.world.fireballs.create(at, 2.2, 4) } catch(e) {}
                this.disposeProjectile(pr, i)
                continue
            }

            pr.pos.addScaledVector(pr.dir, step)
            pr.traveled += step
            pr.mesh.position.copy(pr.pos)
            pr.mesh.rotation.y += delta * 3
            pr.mesh.rotation.x += delta * 2
            if(pr.traveled > 90)
                this.disposeProjectile(pr, i)
        }
    }

    disposeProjectile(pr, i)
    {
        pr.mesh.material.dispose?.()
        pr.mesh.removeFromParent()
        this.bossProjectiles.splice(i, 1)
    }

    // ---------------------------------------------------------------- recibir dano
    takeDamageCheck()
    {
        const weapons = this.game.world.weapons
        if(!weapons || !weapons.projectiles)
            return
        const center = new THREE.Vector3(this.model.position.x, this.model.position.y + this.halfH, this.model.position.z)
        const pBody = this.playerBody
        for(const proj of weapons.projectiles)
        {
            if(proj.__bossHit)
                continue
            // solo los disparos del jugador (excluyen el carro del jugador)
            if(pBody && proj.excludeBody !== pBody)
                continue
            if(proj.pos.distanceTo(center) <= this.hitRadius + proj.radius)
            {
                proj.__bossHit = true
                this.hit(proj.charged ? 4 : 2, proj.pos)
            }
        }
    }

    hit(amount, fromPos)
    {
        if(this.state === 'dead')
            return
        this.hp -= amount
        if(this.hp <= 0)
        {
            this.hp = 0
            this.setState('dead')
            return
        }
        // animacion de golpe segun de donde viene (no interrumpe ataques largos)
        if(this.state === 'fight' && Math.random() < 0.5)
        {
            const d = new THREE.Vector3(fromPos.x - this.model.position.x, 0, fromPos.z - this.model.position.z)
            const yaw = this.model.rotation.y - this.facingOffset
            const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
            const right = new THREE.Vector3(fwd.z, 0, -fwd.x)
            const dotF = d.x * fwd.x + d.z * fwd.z
            const dotR = d.x * right.x + d.z * right.z
            let anim = 'hit_front'
            if(Math.abs(dotR) > Math.abs(dotF)) anim = dotR > 0 ? 'hit_right' : 'hit_front'
            else anim = dotF > 0 ? 'hit_front' : 'hit_back'
            this.play(anim, { loop: false, fade: 0.08 })
            this.attackTimer = Math.max(this.attackTimer, 0.5)
        }
    }

    // ---------------------------------------------------------------- loop
    update()
    {
        if(!this.placed)
        {
            this.place()
            return
        }

        const delta = this.game.ticker.delta
        if(this.mixer)
            this.mixer.update(delta)

        // movimiento controlado (lerp entre puntos)
        if(this.move)
        {
            this.move.t += delta / this.move.duration
            const t = Math.min(1, this.move.t)
            const e = t * t * (3 - 2 * t) // smoothstep
            this.model.position.lerpVectors(this.move.from, this.move.to, e)
            if(t >= 1)
                this.move = null
        }

        // el cuerpo fisico sigue al jefe (solido para los disparos)
        if(this.body)
        {
            try
            {
                this.body.setNextKinematicTranslation({ x: this.model.position.x, y: this.model.position.y + this.halfH, z: this.model.position.z })
            }
            catch(e) {}
        }

        // proyectiles + recibir dano
        this.updateBossProjectiles(delta)
        if(this.state !== 'dead')
            this.takeDamageCheck()

        // mirar al jugador salvo cuando esta quieto en guardia lejos
        if(this.state === 'fight' || this.state === 'emerge')
            this.faceTo(this.playerPos, delta, 7)
        else if(this.state === 'guard')
            this.faceTo(this.playerPos, delta, 1.5)

        // maquina de estados
        const dist = this.distanceToPlayerFromHome()

        if(this.state === 'guard')
        {
            // detecta por cercania (confiable); esconderte rompe el contacto YA en pelea
            if(dist < this.detectRadius)
                this.setState('emerge')
        }
        else if(this.state === 'emerge')
        {
            if(!this.move)
                this.setState('fight')
        }
        else if(this.state === 'fight')
        {
            // perder al jugador: lejos o sin linea de vista por un rato
            if(dist > this.loseRadius || this.losBlocked())
            {
                this.loseTimer += delta
                if(this.loseTimer > this.loseAfter)
                {
                    this.loseTimer = 0
                    this.setState('retreat')
                }
            }
            else
                this.loseTimer = 0

            // ciclo de ataques
            this.attackTimer -= delta
            if(this.attackTimer <= 0 && !this.move)
                this.doAttack()

            // rayos durante la batalla
            this.lightningTimer -= delta
            if(this.lightningTimer <= 0)
            {
                this.lightningTimer = 1.6 + Math.random() * 1.8
                try { this.game.world.lightnings.createRandom(() => Math.random()) } catch(e) {}
            }
        }
        else if(this.state === 'retreat')
        {
            if(!this.move)
                this.setState('guard')
        }
    }
}
