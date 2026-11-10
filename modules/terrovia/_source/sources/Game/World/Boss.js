import * as THREE from 'three/webgpu'
import { add, cameraPosition, color, Fn, normalGeometry, normalWorld, positionGeometry, positionWorld, texture, vec4 } from 'three/tsl'
import gsap from 'gsap'
import { Game } from '../Game.js'

/**
 * DecFreedom - Jefe (Boss) con motor de combate.
 *
 * Monstruo 1 (Warrok): guarda el altar (pentagrama). Es un DEMONIO magico: ataca con
 * hechizos, biyudamas de fuego y una onda expansiva; no con balas.
 *
 * Comportamiento:
 * - En REPOSO tiene vision FRONTAL (un cono). Si te acercas por delante y te ve, despierta.
 *   Si lo ves de espalda, el no te ve: no pasa nada y NO se hace de noche.
 * - Si recibe DANO desde cualquier parte del mapa estando en reposo, despierta y va a
 *   CAZAR al atacante, agresivo, siguiendolo aunque se mueva, hasta alcanzarlo.
 * - Donde te alcanza EMPIEZA la pelea: ahi se hace de noche, caen rayos y encadena combos
 *   aleatorios + a veces se hace el muerto. Si escapas de ese lugar, se calma y regresa,
 *   y vuelve el dia.
 *
 * Es KINEMATICO y sigue el suelo con un rayo hacia abajo: nunca se mete bajo el piso ni se
 * traba. Sus proyectiles reusan la explosion del juego. No toca la Biyudama del jugador.
 */
export class Boss
{
    constructor()
    {
        this.game = Game.getInstance()

        this.placed = false
        this.state = 'guard'            // guard | hunt | fight | retreat | dead
        this.mixer = null
        this.actions = {}
        this.current = null

        // vida
        this.maxHp = 80
        this.hp = this.maxHp

        // cerebro de combos aleatorios + hacerse el muerto
        this.queue = []
        this.busy = 0
        this.gap = 0.8
        this.feigning = false
        this.feignTimer = 0
        this.feignCooldown = 6

        // deteccion / vision / caza / correa
        this.detectRadius = 22
        this.visionConeCos = Math.cos(THREE.MathUtils.degToRad(70))   // cono frontal +-70 grados
        this.huntSpeed = 10
        this.walkSpeed = 6
        this.fightRange = 9
        this.loseRadius = 34
        this.loseAfter = 3.5
        this.loseTimer = 0
        this.huntTimer = 0
        this.huntGiveup = 30            // si no lo alcanza en este tiempo, se calma
        this.homeMaxRange = 170         // si el jugador se va larguisimo, se calma

        // proyectiles del jefe
        this.bossProjectiles = []
        this.sphere = new THREE.SphereGeometry(1, 20, 20)

        // movimiento controlado (lerp entre puntos, para los pasos de combo)
        this.move = null

        // onda expansiva (energia que se absorbe al centro)
        this.chargeGroup = null
        this.chargeParts = []

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

        this.model = gltf.scene
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3())
        const s = 5.2 / (size.y || 1)
        this.scale = s
        this.size = size
        this.halfH = size.y * s * 0.5

        this.model.scale.setScalar(s)
        this.home = new THREE.Vector3(pos.x, pos.y - box.min.y * s, pos.z)
        this.anchor = this.home.clone()                       // punto de correa (en reposo = casa)
        this.model.position.copy(this.home)
        this.facingOffset = 0                                 // mira de FRENTE
        this.baseYaw = Math.atan2(-this.home.x, -this.home.z) // mira hacia el centro del mapa en reposo
        this.model.rotation.y = this.baseYaw
        this.model.traverse((c) =>
        {
            if(c.isMesh || c.isSkinnedMesh)
            {
                c.castShadow = true
                c.frustumCulled = false
            }
        })
        this.game.scene.add(this.model)

        // quitar la DERIVA HORIZONTAL de la raiz (root motion) para animar EN EL SITIO.
        // Asi el codigo controla la posicion y no hay saltos/embestidas que "regresan".
        // Se conserva la Y (el arco del salto / el bob), solo se anula x/z.
        for(const clip of gltf.animations)
            for(const track of clip.tracks)
                if(/hips\.position$/i.test(track.name))
                {
                    const v = track.values
                    for(let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 2] = 0 }
                }

        this.mixer = new THREE.AnimationMixer(this.model)
        for(const clip of gltf.animations)
            this.actions[clip.name] = this.mixer.clipAction(clip)
        this.play('idle')

        // huesos de las manos (para que las biyudamas salgan de las manos)
        this.handR = this.model.getObjectByName('mixamorig:RightHand') || this.model.getObjectByName('mixamorig:RightHandMiddle1')
        this.handL = this.model.getObjectByName('mixamorig:LeftHand') || this.model.getObjectByName('mixamorig:LeftHandMiddle1')

        // barra de vida flotante (feedback de que le estas dando)
        this.buildHealthBar()

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
        const cur = this.model.rotation.y
        let diff = wanted - cur
        while(diff > Math.PI) diff -= Math.PI * 2
        while(diff < -Math.PI) diff += Math.PI * 2
        this.model.rotation.y = cur + diff * Math.min(1, delta * speed)
    }

    // mueve al jefe hacia un punto sobre el suelo; devuelve la distancia que falta
    moveToward(target, speed, delta)
    {
        const dx = target.x - this.model.position.x
        const dz = target.z - this.model.position.z
        const d = Math.sqrt(dx * dx + dz * dz)
        if(d < 0.001)
            return 0
        const stepLen = Math.min(d, speed * delta)
        const nx = this.model.position.x + (dx / d) * stepLen
        const nz = this.model.position.z + (dz / d) * stepLen
        const ny = this.groundY(nx, nz, this.model.position.y)
        this.model.position.set(nx, ny, nz)
        return d - stepLen
    }

    // ve al jugador solo si esta cerca Y dentro de su cono frontal (de espalda no lo ve)
    seesPlayer()
    {
        const p = this.playerPos
        const dx = p.x - this.model.position.x
        const dz = p.z - this.model.position.z
        const d = Math.sqrt(dx * dx + dz * dz)
        if(d > this.detectRadius)
            return false
        if(d < 4)
            return true                       // pegado encima: lo siente
        const yaw = this.model.rotation.y - this.facingOffset
        const fwdx = Math.sin(yaw), fwdz = Math.cos(yaw)
        return (dx * fwdx + dz * fwdz) / d > this.visionConeCos
    }

    playerDistTo(point)
    {
        const p = this.playerPos
        return Math.sqrt((p.x - point.x) ** 2 + (p.z - point.z) ** 2)
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
            return typeof toi === 'number' && toi < dist - 2.0
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

        if(s === 'hunt')
        {
            // despierta y va a cazar (de dia; la noche empieza al alcanzarte)
            this.move = null
            this.huntTimer = 0
            this.play('walk', { fade: 0.15 })
        }
        else if(s === 'fight')
        {
            // la pelea empieza AQUI: este punto es la correa, y aqui se hace de noche
            this.anchor = this.model.position.clone()
            this.move = null
            this.queue = []
            this.busy = 0
            this.gap = 0.4
            this.feigning = false
            this.loseTimer = 0
            this.play('idle')
            this.startBattle()
        }
        else if(s === 'retreat')
        {
            this.move = null
            this.play('walk', { fade: 0.2 })
            this.endBattle()
        }
        else if(s === 'guard')
        {
            this.anchor = this.home.clone()
            this.move = null
            this.endBattle()               // en reposo siempre es de dia
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

    // despertar por dano (desde cualquier parte): ir a cazar al jugador
    wake()
    {
        if(this.state === 'guard' || this.state === 'retreat')
            this.setState('hunt')
    }

    // ---------------------------------------------------------------- batalla (atmosfera)
    startBattle()
    {
        if(this.battleOn)
            return
        this.battleOn = true
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

    // ---------------------------------------------------------------- cerebro de ataques
    inFight()
    {
        return this.state === 'fight' && !this.feigning
    }

    pickCombo()
    {
        const dist = this.playerPos.distanceTo(this.model.position)
        const pool = [
            [ 'charge', 'clap' ],
            [ 'rollTo', 'charge' ],
            [ 'rollTo', 'shock' ],
            [ 'throwSmall', 'throw' ],
            [ 'search', 'throw' ],
            [ 'clap', 'shock' ],
            [ 'charge', 'clap', 'shock' ],
            [ 'walkTo', 'clap' ],
            [ 'throw' ],
            [ 'throwSmall', 'throwSmall', 'throw' ],
            [ 'shock' ],
            [ 'rollTo', 'clap', 'throw' ],
            [ 'taunt', 'charge' ],
            [ 'walkTo', 'throwSmall', 'clap' ],
        ]
        if(dist > 15 && Math.random() < 0.6)
            return [ 'walkTo', 'throw' ]
        return pool[Math.floor(Math.random() * pool.length)].slice()
    }

    startStep(name)
    {
        const p = this.playerPos

        if(name === 'throw')
        {
            // biyudama grande: sale cuando estira las dos manos al frente
            this.play('throw_bijudama', { loop: false, fade: 0.1 })
            gsap.delayedCall(0.6, () => { if(this.inFight()) this.spawnBossProjectile(false) })
            return 1.3
        }
        if(name === 'throwSmall')
        {
            // biyudama chica: se pasa de una mano a la otra y luego la lanza
            this.play('throw_combo', { loop: false, fade: 0.1 })
            gsap.delayedCall(0.25, () => { if(this.inFight()) this.passBijudama() })
            return 1.4
        }
        if(name === 'clap')
        {
            // aplauso estilo Hulk: onda de aire hacia adelante
            this.play('clap_attack', { loop: false, fade: 0.1 })
            gsap.delayedCall(0.85, () => { if(this.inFight()) this.clapWave() })
            return 1.5
        }
        if(name === 'shock')
        {
            // reune poder (energia que se absorbe) y suelta la onda perimetral
            this.play('power_shockwave', { loop: false, fade: 0.1 })
            this.spawnChargeOrb()
            gsap.delayedCall(1.0, () => this.releaseShockwave())
            return 2.0
        }
        if(name === 'charge' || name === 'rollTo' || name === 'walkTo')
        {
            const anim = name === 'charge' ? 'charge' : (name === 'rollTo' ? 'roll_forward' : 'walk')
            this.play(anim, { loop: false, fade: 0.1 })
            const dir = new THREE.Vector3(p.x - this.model.position.x, 0, p.z - this.model.position.z)
            const len = dir.length() || 1
            dir.multiplyScalar(1 / len)
            const reach = name === 'charge' ? 5.5 : (name === 'rollTo' ? 5 : 3.5)
            let tx = this.model.position.x + dir.x * reach
            let tz = this.model.position.z + dir.z * reach
            // correa: no se aleja mas de 16 del punto donde empezo la pelea
            const hx = tx - this.anchor.x, hz = tz - this.anchor.z
            const hl = Math.sqrt(hx * hx + hz * hz)
            if(hl > 16) { tx = this.anchor.x + hx / hl * 16; tz = this.anchor.z + hz / hl * 16 }
            const ty = this.groundY(tx, tz, this.model.position.y)
            this.startMove(this.model.position.clone(), new THREE.Vector3(tx, ty, tz), name === 'charge' ? 0.55 : 0.85)
            if(name === 'charge')
                gsap.delayedCall(0.55, () => { if(this.inFight()) { const f = this.frontPoint(2.5); try { this.game.world.fireballs.create(f, 2.5, 4) } catch(e) {} } })
            return name === 'charge' ? 1.1 : 1.2
        }
        if(name === 'search' || name === 'taunt')
        {
            this.play('search_left', { loop: false, fade: 0.1 })
            return 0.9
        }
        return 0.6
    }

    // hacerse el MUERTO: cae, y cuando te acercas (o pasa un rato) se levanta de golpe
    startFeign()
    {
        this.feigning = true
        this.queue = []
        this.busy = 0
        this.move = null
        this.play('death', { loop: false, fade: 0.12 })
        this.feignTimer = 2.2 + Math.random() * 2.3
        this.feignCooldown = 14
    }

    reviveFeign()
    {
        this.feigning = false
        this.play('roll_forward', { loop: false, fade: 0.12 })
        this.busy = 1.0
        this.queue = Math.random() < 0.5 ? [ 'shock' ] : [ 'charge', 'clap' ]
        this.gap = 0
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

    // posicion de la mano ('R' derecha, 'L' izquierda, 'C' centro entre ambas)
    handPoint(which)
    {
        if(which === 'C' && this.handR && this.handL)
            return this.handR.getWorldPosition(new THREE.Vector3()).add(this.handL.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
        const bone = which === 'R' ? this.handR : (which === 'L' ? this.handL : null)
        if(bone) return bone.getWorldPosition(new THREE.Vector3())
        const fp = this.frontPoint(1.6)
        fp.y = this.model.position.y + this.halfH * 1.1
        return fp
    }

    spawnBossProjectile(small = false)
    {
        const from = this.handPoint(small ? 'L' : 'C')
        const p = this.playerPos
        const target = new THREE.Vector3(p.x, p.y + 0.25, p.z)   // apuntar al carro (bajo)
        const dir = target.clone().sub(from).normalize()

        const r = small ? 0.42 : 0.9
        const mesh = new THREE.Mesh(this.sphere, this.fireMaterial())
        mesh.scale.setScalar(r)
        mesh.position.copy(from)
        this.game.scene.add(mesh)

        this.bossProjectiles.push({ mesh, pos: from.clone(), dir, speed: small ? 28 : 24, traveled: 0, radius: r })
    }

    // reunir poder: nucleo que crece + particulas de energia que se ABSORBEN al centro
    spawnChargeOrb()
    {
        const center = new THREE.Vector3(this.model.position.x, this.model.position.y + this.halfH, this.model.position.z)
        this.chargeGroup = new THREE.Group()
        this.chargeGroup.position.copy(center)
        this.game.scene.add(this.chargeGroup)

        this.chargeCore = new THREE.Mesh(this.sphere, this.fireMaterial())
        this.chargeCore.scale.setScalar(0.15)
        this.chargeGroup.add(this.chargeCore)
        gsap.to(this.chargeCore.scale, { x: 2, y: 2, z: 2, duration: 0.95, ease: 'power2.in' })

        if(!this.partGeo) this.partGeo = new THREE.SphereGeometry(0.13, 8, 8)
        if(!this.partMat) this.partMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ff7a4d').multiplyScalar(3), transparent: true })

        this.chargeParts = []
        for(let i = 0; i < 18; i++)
        {
            const m = new THREE.Mesh(this.partGeo, this.partMat)
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u)
            m.__dir = new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a))
            m.__dist = 2.6 + Math.random() * 2.4
            this.chargeGroup.add(m)
            this.chargeParts.push(m)
        }
    }

    updateChargeOrb(delta)
    {
        if(!this.chargeGroup)
            return
        const ang = delta * 3.2, cos = Math.cos(ang), sin = Math.sin(ang)
        for(const m of this.chargeParts)
        {
            const d = m.__dir
            const dx = d.x * cos - d.z * sin, dz = d.x * sin + d.z * cos
            d.x = dx; d.z = dz
            m.__dist = Math.max(0.12, m.__dist - delta * 3)
            m.position.copy(d).multiplyScalar(m.__dist)
            m.scale.setScalar(0.5 + m.__dist * 0.18)
        }
    }

    // soltar: anillo perimetral que crece hacia afuera + empuje real (reusa la explosion)
    releaseShockwave()
    {
        if(this.chargeGroup)
        {
            this.chargeGroup.removeFromParent()
            this.chargeGroup = null
            this.chargeParts = []
        }
        const gy = this.model.position.y
        const center = new THREE.Vector3(this.model.position.x, gy + 1.0, this.model.position.z)

        // nucleo: fogonazo breve y brillante (el "boom"), NO un globo que lo tapa todo
        const coreMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        coreMat.colorNode = color('#ffd6a0').mul(3)
        const core = new THREE.Mesh(this.sphere, coreMat)
        core.position.copy(center)
        core.scale.setScalar(0.35)
        this.game.scene.add(core)
        gsap.to(core.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.24, ease: 'power3.out' })
        gsap.to(coreMat, { opacity: 0, duration: 0.3, ease: 'power1.in', onComplete: () =>
        {
            coreMat.dispose?.()
            core.removeFromParent()
        } })

        // onda doble: dos anillos finos que VIAJAN por el suelo hacia afuera y se desvanecen
        const makeRing = (delay, maxR, col) =>
        {
            const m = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
            m.colorNode = color(col).mul(3)
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.74, 1, 64), m)
            ring.rotation.x = -Math.PI * 0.5
            ring.position.set(center.x, gy + 0.22, center.z)
            ring.scale.set(0.6, 0.6, 1)
            this.game.scene.add(ring)
            const s = { v: 0.6 }
            gsap.to(s, { v: maxR, duration: 0.7, delay, ease: 'power2.out', onUpdate: () => ring.scale.set(s.v, s.v, 1) })
            gsap.to(m, { opacity: 0, duration: 0.7, delay, ease: 'power1.in', onComplete: () =>
            {
                m.dispose?.()
                ring.geometry.dispose()
                ring.removeFromParent()
            } })
        }
        makeRing(0, 13, '#ff6a3c')
        makeRing(0.12, 9, '#ffd08a')

        // empuje real (reusa la explosion) pero CONTENIDO: nada de bola gigante amarilla
        try { this.game.world.fireballs.create(center, 2.2, 4) } catch(e) {}
    }

    // ---------------------------------------------------------------- efectos extra
    // aplauso estilo Hulk: onda de aire que se expande HACIA ADELANTE y empuja
    clapWave()
    {
        const yaw = this.model.rotation.y - this.facingOffset
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
        const origin = new THREE.Vector3(
            this.model.position.x + fwd.x * 1.6,
            this.model.position.y + this.halfH,
            this.model.position.z + fwd.z * 1.6
        )
        const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        mat.colorNode = color('#ffd8c0').mul(2.2)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.7, 40), mat)
        ring.position.copy(origin)
        ring.lookAt(origin.clone().add(fwd))
        this.game.scene.add(ring)
        const s = { v: 1 }
        gsap.to(s, { v: 9, duration: 0.42, ease: 'power2.out', onUpdate: () => ring.scale.set(s.v, s.v, 1) })
        gsap.to(ring.position, { x: origin.x + fwd.x * 6, y: origin.y, z: origin.z + fwd.z * 6, duration: 0.42, ease: 'power2.out' })
        gsap.to(mat, { opacity: 0, duration: 0.42, onComplete: () =>
        {
            mat.dispose?.()
            ring.geometry.dispose()
            ring.removeFromParent()
        } })
        try { this.game.world.fireballs.create(origin.clone().add(fwd.clone().multiplyScalar(3)), 1.5, 2.8) } catch(e) {}
    }

    // pasar una biyudama PEQUENA de una mano a la otra y lanzarla
    passBijudama()
    {
        const orb = new THREE.Mesh(this.sphere, this.fireMaterial())
        orb.scale.setScalar(0.38)
        orb.position.copy(this.handPoint('R'))
        this.game.scene.add(orb)
        const t = { v: 0 }
        gsap.to(t, { v: 1, duration: 0.5, ease: 'sine.inOut',
            onUpdate: () => orb.position.lerpVectors(this.handPoint('R'), this.handPoint('L'), t.v),
            onComplete: () =>
            {
                const from = this.handPoint('L')
                const p = this.playerPos
                const dir = new THREE.Vector3(p.x, p.y + 0.25, p.z).sub(from).normalize()
                orb.position.copy(from)
                this.bossProjectiles.push({ mesh: orb, pos: from.clone(), dir, speed: 28, traveled: 0, radius: 0.38 })
            }
        })
    }

    // chispa brillante al recibir un disparo (feedback de que le estas dando)
    spawnHitSpark(at)
    {
        const mat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#fff1b0').multiplyScalar(5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        const spark = new THREE.Mesh(this.sphere, mat)
        spark.position.set(at.x, at.y, at.z)
        spark.scale.setScalar(0.22)
        this.game.scene.add(spark)
        gsap.to(spark.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.22, ease: 'power2.out' })
        gsap.to(mat, { opacity: 0, duration: 0.25, onComplete: () =>
        {
            mat.dispose?.()
            spark.removeFromParent()
        } })
    }

    // barra de vida flotante
    buildHealthBar()
    {
        this.hpBar = new THREE.Group()
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#140207'), transparent: true }))
        this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.28), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ff2e2e').multiplyScalar(2) }))
        this.hpFill.position.z = 0.02
        this.hpBar.add(bg)
        this.hpBar.add(this.hpFill)
        this.hpBar.visible = false
        this.game.scene.add(this.hpBar)
    }

    updateHealthBar()
    {
        if(!this.hpBar)
            return
        const show = this.state === 'fight' || this.state === 'hunt'
        this.hpBar.visible = show
        if(!show)
            return
        const topY = this.model.position.y + this.size.y * this.scale + 1.3
        this.hpBar.position.set(this.model.position.x, topY, this.model.position.z)
        this.hpBar.quaternion.copy(this.game.view.camera.quaternion)
        const ratio = Math.max(0, this.hp / this.maxHp)
        this.hpFill.scale.x = ratio
        this.hpFill.position.x = -(3 * (1 - ratio)) / 2
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
            if(pBody && proj.excludeBody !== pBody)      // solo los disparos del jugador
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
        this.spawnHitSpark(fromPos)        // feedback: chispa de que le estas dando
        if(this.hp <= 0)
        {
            this.hp = 0
            this.setState('dead')
            return
        }

        // dano desde cualquier parte estando en reposo: despierta y va a cazar
        if(this.state === 'guard' || this.state === 'retreat')
        {
            this.wake()
            return
        }
        if(this.state === 'hunt')
            return

        // en pelea: a veces se hace el MUERTO (sorpresa)
        if(this.feigning)
            return
        if(this.feignCooldown <= 0 && this.hp > 12 && Math.random() < 0.22)
        {
            this.startFeign()
            return
        }

        // animacion de golpe segun de donde viene (sin interrumpir un movimiento)
        if(!this.move && Math.random() < 0.5)
        {
            const d = new THREE.Vector3(fromPos.x - this.model.position.x, 0, fromPos.z - this.model.position.z)
            const yaw = this.model.rotation.y - this.facingOffset
            const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
            const right = new THREE.Vector3(fwd.z, 0, -fwd.x)
            const dotF = d.x * fwd.x + d.z * fwd.z
            const dotR = d.x * right.x + d.z * right.z
            let anim = 'hit_front'
            if(Math.abs(dotR) > Math.abs(dotF)) anim = dotR > 0 ? 'hit_right' : 'stagger_right'
            else anim = dotF > 0 ? 'hit_front' : 'hit_back'
            this.play(anim, { loop: false, fade: 0.08 })
            this.busy = Math.max(this.busy, 0.35)
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
        this.updateChargeOrb(delta)

        // movimiento controlado por pasos de combo (lerp)
        if(this.move)
        {
            this.move.t += delta / this.move.duration
            const t = Math.min(1, this.move.t)
            const e = t * t * (3 - 2 * t)
            this.model.position.lerpVectors(this.move.from, this.move.to, e)
            if(t >= 1)
                this.move = null
        }

        // el cuerpo fisico sigue al jefe (solido para los disparos)
        if(this.body)
        {
            try { this.body.setNextKinematicTranslation({ x: this.model.position.x, y: this.model.position.y + this.halfH, z: this.model.position.z }) }
            catch(e) {}
        }

        this.updateBossProjectiles(delta)
        if(this.state !== 'dead')
            this.takeDamageCheck()
        this.updateHealthBar()

        // ---- orientacion segun estado ----
        if(this.state === 'guard')
            this.model.rotation.y = this.baseYaw + Math.sin(this.game.ticker.elapsed * 0.5) * 0.7   // vigila (barrido)
        else if(this.state === 'hunt' || this.state === 'fight')
            this.faceTo(this.playerPos, delta, 7)
        else if(this.state === 'retreat')
            this.faceTo(this.home, delta, 4)

        // ---- maquina de estados ----
        if(this.state === 'guard')
        {
            if(this.seesPlayer())
                this.setState('hunt')
        }
        else if(this.state === 'hunt')
        {
            // perseguir agresivo hasta alcanzarlo
            this.huntTimer += delta
            const remaining = this.moveToward(this.playerPos, this.huntSpeed, delta)
            if(remaining <= this.fightRange)
                this.setState('fight')                 // AQUI empieza la pelea (y la noche)
            else if(this.huntTimer > this.huntGiveup || this.distanceToHome(this.playerPos) > this.homeMaxRange)
                this.setState('retreat')               // no lo alcanza / se fue larguisimo
        }
        else if(this.state === 'fight')
        {
            this.feignCooldown -= delta

            if(this.feigning)
            {
                this.feignTimer -= delta
                const near = this.playerPos.distanceTo(this.model.position) < 8
                if(this.feignTimer <= 0 || near)
                    this.reviveFeign()
            }
            else
            {
                // perder al jugador si ESCAPA del lugar donde empezo la pelea
                if(this.playerDistTo(this.anchor) > this.loseRadius || this.losBlocked())
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

                // cerebro: encadenar combos con pausas aleatorias
                if(this.busy > 0)
                    this.busy -= delta
                else if(this.queue.length > 0 && !this.move)
                    this.busy = this.startStep(this.queue.shift())
                else if(this.queue.length === 0)
                {
                    this.gap -= delta
                    if(this.gap <= 0 && !this.move)
                    {
                        this.queue = this.pickCombo()
                        this.gap = 0.9 + Math.random() * 1.3
                    }
                }
            }

            // rayos durante la batalla
            this.lightningTimer -= delta
            if(this.lightningTimer <= 0)
            {
                this.lightningTimer = 1.4 + Math.random() * 1.6
                try { this.game.world.lightnings.createRandom(() => Math.random()) } catch(e) {}
            }
        }
        else if(this.state === 'retreat')
        {
            const remaining = this.moveToward(this.home, this.walkSpeed, delta)
            if(remaining < 1.5)
                this.setState('guard')
            else if(this.seesPlayer())          // si te metes en su cara mientras vuelve, pelea
                this.setState('hunt')
        }
    }

    distanceToHome(point)
    {
        return Math.sqrt((point.x - this.home.x) ** 2 + (point.z - this.home.z) ** 2)
    }
}
