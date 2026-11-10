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
        this.hitReactCd = 0             // enfriamiento de la animacion de recibir golpe

        // deteccion / vision / caza / correa
        this.detectRadius = 22
        this.visionConeCos = Math.cos(THREE.MathUtils.degToRad(70))   // cono frontal +-70 grados
        this.huntSpeed = 9
        this.walkSpeed = 4.5
        this.fightRange = 9
        this.loseRadius = 42        // aguanta mas antes de rendirse (te persigue aunque te empuje lejos)
        this.loseAfter = 3.5
        this.loseTimer = 0
        this.huntTimer = 0
        this.huntGiveup = 30            // si no lo alcanza en este tiempo, se calma
        this.homeMaxRange = 170         // si el jugador se va larguisimo, se calma

        // proyectiles del jefe
        this.bossProjectiles = []
        this.sphere = new THREE.SphereGeometry(1, 20, 20)

        // fuerza base del EMPUJE al carro (ondas, aplauso, embestida, impactos). Calibrada.
        this.knockBase = 75

        // movimiento controlado (lerp entre puntos, para los pasos de combo)
        this.move = null

        // paso de ataque en curso: los efectos se disparan segun la FASE REAL de la
        // animacion (action.time / duracion), no por temporizadores a ciegas. Asi el
        // efecto sale cuando el movimiento de las manos llega a su punto, sincronizado.
        this.step = null
        this.passOrb = null

        // onda expansiva (energia que se absorbe al centro)
        this.chargeGroup = null
        this.chargeParts = []

        // atmosfera / rayos
        this.battleOn = false
        this.lightningTimer = 0

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 8)

        // El escaneo de dano corre en orden 5, ANTES que Weapons (orden 6). Si no, el disparo
        // del jugador detona contra el collider del jefe y se BORRA del array en orden 6,
        // antes de que lo pudieramos contar en orden 8: por eso "no bajaba vida".
        this.damageScan = this.damageScan.bind(this)
        this.game.ticker.events.on('tick', this.damageScan, 5)
    }

    damageScan()
    {
        if(!this.placed || this.state === 'dead')
            return
        this.takeDamageCheck(this.game.ticker.delta)
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

        // huesos de las manos (para que las biyudamas salgan de las manos).
        // OJO: en este modelo los huesos NO llevan dos puntos: son 'mixamorigRightHand'.
        this.handR = this.model.getObjectByName('mixamorigRightHand') || this.model.getObjectByName('mixamorig:RightHand') || this.model.getObjectByName('mixamorigRightHandMiddle1')
        this.handL = this.model.getObjectByName('mixamorigLeftHand') || this.model.getObjectByName('mixamorig:LeftHand') || this.model.getObjectByName('mixamorigLeftHandMiddle1')

        // barra de vida flotante (feedback de que le estas dando)
        this.buildHealthBar()

        const halfW = Math.max(size.x, size.z) * s * 0.3
        this.obj = this.game.objects.add(null, {
            type: 'kinematicPositionBased',
            position: { x: this.home.x, y: this.home.y + this.halfH, z: this.home.z },
            colliders: [ { shape: 'cuboid', parameters: [ halfW, this.halfH, halfW ], category: 'object' } ]
        })
        this.body = this.obj?.physical?.body || null
        this.hitRadius = Math.max(halfW, 3.0)   // esfera de impacto generosa (es grande)

        this.placed = true
    }

    // distancia minima de un punto c al segmento [p0, p0 + dir*L] (dir unitario)
    segDist(c, p0, dir, L)
    {
        const wx = c.x - p0.x, wy = c.y - p0.y, wz = c.z - p0.z
        let t = wx * dir.x + wy * dir.y + wz * dir.z
        if(t < 0) t = 0
        else if(t > L) t = L
        const cx = p0.x + dir.x * t, cy = p0.y + dir.y * t, cz = p0.z + dir.z * t
        return Math.sqrt((c.x - cx) ** 2 + (c.y - cy) ** 2 + (c.z - cz) ** 2)
    }

    // EMPUJAR al carro/jugador: impulso que lo aleja de 'from' (las ondas y golpes lo mueven)
    knockPlayer(strength, up = 0.35, from = this.model.position)
    {
        const body = this.playerBody
        if(!body)
            return
        const p = this.playerPos
        let dx = p.x - from.x, dz = p.z - from.z
        const d = Math.sqrt(dx * dx + dz * dz) || 1
        dx /= d; dz /= d
        try
        {
            body.applyImpulse({ x: dx * strength, y: Math.abs(strength) * up, z: dz * strength }, true)
            body.wakeUp?.()
        }
        catch(e) {}
    }

    // altura REAL del suelo en (x,z) para poner los efectos justo encima (no bajo el piso)
    groundYAt(x, z)
    {
        return this.groundY(x, z, this.model.position.y)
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
        action.timeScale = 1               // los pasos de ataque le ponen su propia velocidad
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
            const a = this.play('walk', { fade: 0.15 })
            if(a) a.timeScale = 1.8          // cadencia de las piernas acorde a la velocidad (no patina)
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
            const a = this.play('walk', { fade: 0.2 })
            if(a) a.timeScale = 1.2          // camina de vuelta (cadencia acorde, no "jalado con soga")
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
            // CONFETI de logro desde el suelo: lo lograste!
            try
            {
                const gy = this.groundYAt(this.model.position.x, this.model.position.z)
                const c = this.game.world.confetti
                if(c)
                {
                    c.pop(new THREE.Vector3(this.model.position.x, gy, this.model.position.z), 7, 9)
                    c.pop(new THREE.Vector3(this.model.position.x + 2, gy, this.model.position.z - 2), 5, 7)
                }
            }
            catch(e) {}
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
        // noche + rayos (los rayos ya traen su trueno: esa es la tension de la pelea).
        // NO se pausa la musica: antes se quedaba en SILENCIO al pelear. Para una pista de
        // batalla dedicada hace falta un archivo (battle.mp3); mientras, sigue la musica normal.
        try { this.game.dayCycles.override.start({ progress: 0.47 }, 2.5) } catch(e) {}
    }

    endBattle()
    {
        if(!this.battleOn)
            return
        this.battleOn = false
        try { this.game.dayCycles.override.end(3) } catch(e) {}
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

    // registra el paso en curso: sus efectos se disparan por FASE de la animacion
    setStep(action, timeScale, triggers, onTrack = null)
    {
        this.disposePassOrb()               // por si quedo un orbe del paso anterior
        if(action)
            action.timeScale = timeScale
        const clip = action && action.getClip ? action.getClip() : null
        this.step = {
            action,
            baseDur: clip ? clip.duration : 0.6,
            triggers: triggers.map(t => ({ phase: t.phase, fn: t.fn, done: false })),
            onTrack
        }
    }

    // cuanto dura el paso en segundos reales (duracion del clip / velocidad)
    stepDuration(action, timeScale)
    {
        const clip = action && action.getClip ? action.getClip() : null
        return Math.max(0.4, clip ? clip.duration / timeScale : 0.6)
    }

    // procesa el paso cada frame: dispara cada efecto cuando la animacion cruza su fase
    processStep()
    {
        const st = this.step
        if(!st || !st.action)
            return
        if(this.state !== 'fight')   // si dejo la pelea (muerto/retirada), limpiar efectos
        {
            this.disposePassOrb()
            this.disposeChargeOrb()
            this.step = null
            return
        }
        const a = st.action
        const ph = st.baseDur > 0 ? Math.min(1, a.time / st.baseDur) : 1
        for(const tr of st.triggers)
            if(!tr.done && ph >= tr.phase)
            {
                tr.done = true
                try { tr.fn() } catch(e) {}
            }
        if(st.onTrack)
            try { st.onTrack(ph) } catch(e) {}
        if(ph >= 1 || this.current !== a)
            this.step = null
    }

    startStep(name)
    {
        const p = this.playerPos

        if(name === 'throw')
        {
            // biyudama GRANDE: sube las manos, las junta y las ESTIRA al frente (fase ~0.54).
            // Justo ahi, desde las dos manos, sale la biyudama. Antes salia adelantada.
            const a = this.play('throw_bijudama', { loop: false, fade: 0.1 })
            this.setStep(a, 1.55, [ { phase: 0.54, fn: () => this.spawnBossProjectile(false) } ])
            return this.stepDuration(a, 1.55)
        }
        if(name === 'throwSmall')
        {
            // biyudama CHICA: aparece en una mano, se ve PASAR a la otra y luego se lanza.
            const a = this.play('throw_combo', { loop: false, fade: 0.1 })
            this.setStep(a, 2.6, [
                { phase: 0.1, fn: () => this.spawnPassOrb() },      // nace en la IZQUIERDA
                { phase: 0.74, fn: () => this.launchPassOrb() },    // la DERECHA la lanza (pico del gesto)
            ], (ph) => this.trackPassOrb(ph))
            return this.stepDuration(a, 2.6)
        }
        if(name === 'clap')
        {
            // aplauso: la onda de aire sale EN el aplauso, cuando las manos se juntan (fase ~0.66),
            // y va hacia ADELANTE (hacia el jugador/entrada), no de lado.
            const a = this.play('clap_attack', { loop: false, fade: 0.1 })
            this.setStep(a, 1.6, [ { phase: 0.66, fn: () => this.clapWave() } ])
            return this.stepDuration(a, 1.6)
        }
        if(name === 'shock')
        {
            // REUNE energia (se ve acumular del piso al centro) y SUELTA la onda redonda
            // cuando abre los dos brazos a los lados (fase ~0.62). Antes salia antes de cargar.
            const a = this.play('power_shockwave', { loop: false, fade: 0.1 })
            this.setStep(a, 1.25, [
                { phase: 0.06, fn: () => this.spawnChargeOrb(1.4) },
                { phase: 0.62, fn: () => this.releaseShockwave() },
            ])
            return this.stepDuration(a, 1.25)
        }
        if(name === 'charge' || name === 'rollTo' || name === 'walkTo')
        {
            const cfg = {
                charge: { anim: 'charge',        ts: 1.0, reach: 8.0,  moveDur: 0.5 },
                rollTo: { anim: 'roll_forward',  ts: 1.6, reach: 10.0, moveDur: 1.25 },
                walkTo: { anim: 'walk',          ts: 1.5, reach: 4.0,  moveDur: 0.7 },
            }[name]
            const a = this.play(cfg.anim, { loop: false, fade: 0.12 })
            const dir = new THREE.Vector3(p.x - this.model.position.x, 0, p.z - this.model.position.z)
            const len = dir.length() || 1
            dir.multiplyScalar(1 / len)
            let tx = this.model.position.x + dir.x * cfg.reach
            let tz = this.model.position.z + dir.z * cfg.reach
            // correa mas larga (22) para que la embestida/voltereta AVANCEN de verdad
            const hx = tx - this.anchor.x, hz = tz - this.anchor.z
            const hl = Math.sqrt(hx * hx + hz * hz)
            if(hl > 22) { tx = this.anchor.x + hx / hl * 22; tz = this.anchor.z + hz / hl * 22 }
            const ty = this.groundY(tx, tz, this.model.position.y)
            // el movimiento dura casi lo mismo que la animacion: no se traba ni "se pega atras"
            this.startMove(this.model.position.clone(), new THREE.Vector3(tx, ty, tz), cfg.moveDur)
            // embestida: al llegar, empuja y golpea al carro si lo alcanza
            const triggers = (name === 'charge' || name === 'rollTo')
                ? [ { phase: 0.75, fn: () =>
                    {
                        if(this.playerDistTo(this.model.position) < 5)
                        {
                            const f = this.frontPoint(2.2)
                            try { this.game.world.fireballs.create(f, 1.6, 3) } catch(e) {}
                            this.knockPlayer(this.knockBase * 1.1, 0.5, this.model.position)
                        }
                    } } ]
                : []
            this.setStep(a, cfg.ts, triggers)
            return this.stepDuration(a, cfg.ts)
        }
        if(name === 'search' || name === 'taunt')
        {
            const a = this.play('search_left', { loop: false, fade: 0.1 })
            this.setStep(a, 1.0, [])
            return this.stepDuration(a, 1.0)
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

        // boom: la biyudama GRANDE revienta como explosion pero con empuje SUAVE (no te saca del mapa)
        this.bossProjectiles.push({ mesh, pos: from.clone(), dir, speed: small ? 28 : 24, traveled: 0, radius: r,
            boomFire: 2.2, boomRadius: 3, boomStrength: 3 })
    }

    // reunir poder: nucleo que crece en las manos + energia que sube DEL PISO y se absorbe.
    // growDur = cuanto tarda en cargar (sincronizado con la animacion que reune).
    spawnChargeOrb(growDur = 1.2)
    {
        const center = new THREE.Vector3(this.model.position.x, this.model.position.y + this.halfH * 1.05, this.model.position.z)
        this.chargeGroup = new THREE.Group()
        this.chargeGroup.position.copy(center)
        this.chargeBaseY = this.model.position.y          // suelo del jefe (para subir del piso)
        this.game.scene.add(this.chargeGroup)

        this.chargeCore = new THREE.Mesh(this.sphere, this.fireMaterial())
        this.chargeCore.scale.setScalar(0.12)
        this.chargeGroup.add(this.chargeCore)
        gsap.to(this.chargeCore.scale, { x: 1.9, y: 1.9, z: 1.9, duration: growDur, ease: 'power2.in' })

        if(!this.partGeo) this.partGeo = new THREE.SphereGeometry(0.17, 8, 8)
        if(!this.partMat) this.partMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ff8a4a').multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })

        // particulas en un anillo alrededor, PEGADAS AL PISO, que suben en espiral al centro
        this.chargeParts = []
        for(let i = 0; i < 36; i++)
        {
            const m = new THREE.Mesh(this.partGeo, this.partMat)
            m.__ang = Math.random() * Math.PI * 2
            m.__rad = 3 + Math.random() * 3
            m.__y = (this.chargeBaseY - center.y) + Math.random() * 0.4   // arranca en el piso (relativo al centro)
            this.chargeGroup.add(m)
            this.chargeParts.push(m)
        }
    }

    updateChargeOrb(delta)
    {
        if(!this.chargeGroup)
            return
        for(const m of this.chargeParts)
        {
            m.__ang += delta * 3.4
            m.__rad = Math.max(0.1, m.__rad - delta * 3.4)       // se acerca al centro
            m.__y += (-m.__y) * Math.min(1, delta * 3.2)          // sube hasta el centro (y -> 0)
            if(m.__rad <= 0.2)                                     // reciclar: vuelve al piso afuera
            {
                m.__rad = 3 + Math.random() * 3
                m.__y = (this.chargeBaseY - this.chargeGroup.position.y)
            }
            m.position.set(Math.cos(m.__ang) * m.__rad, m.__y, Math.sin(m.__ang) * m.__rad)
            m.scale.setScalar(0.55 + m.__rad * 0.18)
        }
    }

    disposeChargeOrb()
    {
        if(this.chargeGroup)
        {
            this.chargeGroup.removeFromParent()
            this.chargeGroup = null
            this.chargeParts = []
        }
    }

    // SOLTAR: la onda redonda y pareja (como la de las explosiones) que se expande en el suelo
    releaseShockwave()
    {
        this.disposeChargeOrb()
        const gy = this.groundYAt(this.model.position.x, this.model.position.z)   // SUELO real (no bajo el piso)
        const center = new THREE.Vector3(this.model.position.x, gy + 1.0, this.model.position.z)

        // EMPUJE: expulsa al carro pero SIN mandarlo lejisimo (mas suave que antes)
        const pd = this.playerDistTo(this.model.position)
        if(pd < 13)
            this.knockPlayer(this.knockBase * (0.4 + (1 - pd / 13) * 0.5), 0.5, this.model.position)

        // destello breve y CHICO en el centro (apenas un pop, para no tapar el anillo)
        const coreMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        coreMat.colorNode = color('#ffe0b0').mul(3)
        const core = new THREE.Mesh(this.sphere, coreMat)
        core.position.copy(center)
        core.scale.setScalar(0.25)
        this.game.scene.add(core)
        gsap.to(core.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.16, ease: 'power3.out' })
        gsap.to(coreMat, { opacity: 0, duration: 0.24, ease: 'power1.in', onComplete: () => { coreMat.dispose?.(); core.removeFromParent() } })

        // la ONDA (el protagonista): anillo redondo, parejo y BRILLANTE que crece uniforme
        const ringMat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        ringMat.colorNode = color('#ff6a34').mul(4.2)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 96), ringMat)   // mas segmentos = perfectamente redondo
        ring.rotation.x = -Math.PI * 0.5
        ring.position.set(center.x, gy + 0.4, center.z)
        ring.scale.set(0.8, 0.8, 1)
        this.game.scene.add(ring)
        const s = { v: 0.8 }
        gsap.to(s, { v: 12, duration: 0.75, ease: 'power2.out', onUpdate: () => ring.scale.set(s.v, s.v, 1) })
        gsap.to(ringMat, { opacity: 0, duration: 0.75, ease: 'power1.in', onComplete: () => { ringMat.dispose?.(); ring.geometry.dispose(); ring.removeFromParent() } })

        // segundo anillo mas tenue por detras (da sensacion de onda de choque doble)
        const ring2Mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        ring2Mat.colorNode = color('#ffc078').mul(2.4)
        const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), ring2Mat)
        ring2.rotation.x = -Math.PI * 0.5
        ring2.position.set(center.x, gy + 0.38, center.z)
        ring2.scale.set(0.8, 0.8, 1)
        this.game.scene.add(ring2)
        const s2 = { v: 0.8 }
        gsap.to(s2, { v: 8.5, duration: 0.75, delay: 0.1, ease: 'power2.out', onUpdate: () => ring2.scale.set(s2.v, s2.v, 1) })
        gsap.to(ring2Mat, { opacity: 0, duration: 0.75, delay: 0.1, ease: 'power1.in', onComplete: () => { ring2Mat.dispose?.(); ring2.geometry.dispose(); ring2.removeFromParent() } })

        // NOTA: el empuje real lo hace knockPlayer (fisica), no la explosion. No metemos
        // fireball aqui porque su bloom tapaba al jefe. El protagonista es el ANILLO redondo.
    }

    // ---------------------------------------------------------------- efectos extra
    // aplauso estilo Hulk: al juntar las manos, estalla una onda HACIA ADELANTE (al jugador)
    clapWave()
    {
        const yaw = this.model.rotation.y - this.facingOffset
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
        const fxp = this.model.position.x + fwd.x * 2.2, fzp = this.model.position.z + fwd.z * 2.2
        const gy = this.groundYAt(fxp, fzp)   // SUELO real delante del jefe (no bajo el piso)
        // centro de la onda: un poco ADELANTE del jefe, sobre el piso
        const front = new THREE.Vector3(fxp, gy + 0.4, fzp)

        // EMPUJE real: si el carro esta en el cono de adelante y dentro de rango, lo expulsa
        {
            const p = this.playerPos
            let tx = p.x - this.model.position.x, tz = p.z - this.model.position.z
            const dist = Math.sqrt(tx * tx + tz * tz)
            if(dist > 0.1 && dist < 11)
            {
                const dot = (tx / dist) * fwd.x + (tz / dist) * fwd.z
                if(dot > 0.3)
                    this.knockPlayer(this.knockBase * 0.95, 0.5, this.model.position)
            }
        }

        // anillo en el suelo que nace delante y se expande (se lee claro desde arriba)
        const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        mat.colorNode = color('#ffd27a').mul(3)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 80), mat)
        ring.rotation.x = -Math.PI * 0.5
        ring.position.copy(front)
        ring.scale.set(0.7, 0.7, 1)
        this.game.scene.add(ring)
        const s = { v: 0.7 }
        gsap.to(s, { v: 8, duration: 0.5, ease: 'power2.out', onUpdate: () => ring.scale.set(s.v, s.v, 1) })
        // ademas se desplaza un poco mas hacia adelante (empujon de aire)
        gsap.to(ring.position, { x: front.x + fwd.x * 3, z: front.z + fwd.z * 3, duration: 0.5, ease: 'power2.out' })
        gsap.to(mat, { opacity: 0, duration: 0.5, ease: 'power1.in', onComplete: () => { mat.dispose?.(); ring.geometry.dispose(); ring.removeFromParent() } })

        // segundo anillo mas chico que sale un pelin despues (doble chasquido)
        const mat2 = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
        mat2.colorNode = color('#fff0c8').mul(2.6)
        const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.95, 72), mat2)
        ring2.rotation.x = -Math.PI * 0.5
        ring2.position.set(front.x, gy + 0.42, front.z)
        ring2.scale.set(0.6, 0.6, 1)
        this.game.scene.add(ring2)
        const s2 = { v: 0.6 }
        gsap.to(s2, { v: 5.5, duration: 0.45, delay: 0.08, ease: 'power2.out', onUpdate: () => ring2.scale.set(s2.v, s2.v, 1) })
        gsap.to(mat2, { opacity: 0, duration: 0.45, delay: 0.08, ease: 'power1.in', onComplete: () => { mat2.dispose?.(); ring2.geometry.dispose(); ring2.removeFromParent() } })

        // fogonazo real adelante (explosion del juego), CHICO
        try { this.game.world.fireballs.create(new THREE.Vector3(this.model.position.x + fwd.x * 3.2, gy + 0.8, this.model.position.z + fwd.z * 3.2), 1.0, 2.2) } catch(e) {}
    }

    // ---- biyudama chica que se PASA de una mano a la otra y luego se lanza ----
    spawnPassOrb()
    {
        this.disposePassOrb()
        const orb = new THREE.Mesh(this.sphere, this.fireMaterial())
        orb.scale.setScalar(0.34)
        orb.position.copy(this.handPoint('L'))   // nace en la IZQUIERDA (ahi esta activa al inicio)
        this.game.scene.add(orb)
        this.passOrb = orb
    }

    // sigue a las manos EN VIVO: queda en la IZQUIERDA, se transfiere a la DERECHA en el
    // windup (cuando las manos se juntan) y se queda en la derecha hasta el lanzamiento.
    trackPassOrb(ph)
    {
        if(!this.passOrb)
            return
        if(ph < 0.46)
            this.passOrb.position.copy(this.handPoint('L'))                 // claramente en la izquierda
        else if(ph < 0.6)
            this.passOrb.position.lerpVectors(this.handPoint('L'), this.handPoint('R'), (ph - 0.46) / 0.14)   // pase
        else
            this.passOrb.position.copy(this.handPoint('R'))                 // ya en la derecha (lista para tirar)
    }

    launchPassOrb()
    {
        if(!this.passOrb)
            return
        const orb = this.passOrb
        this.passOrb = null
        const from = this.handPoint('R')   // la DERECHA la lanza (el gesto de tiro es con la derecha)
        const p = this.playerPos
        const dir = new THREE.Vector3(p.x, p.y + 0.25, p.z).sub(from).normalize()
        orb.position.copy(from)
        // boom: la biyudama CHICA empuja aun MENOS (antes te mandaba a kilometros)
        this.bossProjectiles.push({ mesh: orb, pos: from.clone(), dir, speed: 30, traveled: 0, radius: 0.34,
            boomFire: 1.5, boomRadius: 2.2, boomStrength: 2.3 })
    }

    disposePassOrb()
    {
        if(this.passOrb)
        {
            this.passOrb.material?.dispose?.()
            this.passOrb.removeFromParent()
            this.passOrb = null
        }
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
                // explosion con empuje SUAVE (strength bajo): te empuja pero NO te saca del mapa.
                // Nada de knockPlayer extra: antes se sumaban los dos y te mandaba lejisimo.
                try { this.game.world.fireballs.create(at, pr.boomFire || 2, pr.boomRadius || 3, pr.boomStrength || 3) } catch(e) {}
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
    // Esfera BARRIDA: en vez de mirar la distancia puntual (que fallaba por un frame porque
    // el disparo va rapido), miro el SEGMENTO que el disparo recorre este frame, igual que el
    // raycast del arma. Cuando pega, CONSUMO el disparo yo mismo (explosion + lo quito) para
    // garantizar que el impacto cuenta aunque el collider no lo frene.
    takeDamageCheck(delta)
    {
        const weapons = this.game.world.weapons
        if(!weapons || !weapons.projectiles || !this.model)
            return
        const center = new THREE.Vector3(this.model.position.x, this.model.position.y + this.halfH, this.model.position.z)
        const pBody = this.playerBody
        const dt = delta || 0.016
        for(let i = weapons.projectiles.length - 1; i >= 0; i--)
        {
            const proj = weapons.projectiles[i]
            if(proj.__bossHit)
                continue
            if(pBody && proj.excludeBody && proj.excludeBody !== pBody)   // ignora disparos remotos
                continue
            const reach = proj.speed * dt + proj.radius + 0.6
            if(this.segDist(center, proj.pos, proj.dir, reach) <= this.hitRadius + proj.radius)
            {
                proj.__bossHit = true
                this.hit(proj.charged ? 5 : 2.5, proj.pos.clone())
                try { weapons.detonate(proj, proj.pos) } catch(e) {}   // explosion en el jefe + lo consume
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

        // REACCION de golpe visible y DIRECCIONAL (de frente / espalda / lados), con un
        // pequeno enfriamiento para que se vea cada tanto sin dejarlo en stun eterno. No
        // interrumpe una embestida/voltereta en curso (esas terminan).
        if(!this.move && this.hitReactCd <= 0)
        {
            this.step = null                 // interrumpe el hechizo en curso (lo reincorporas a golpes)
            this.disposeChargeOrb()
            this.disposePassOrb()
            this.play(this.hitAnimFor(fromPos), { loop: false, fade: 0.07 })
            this.busy = Math.max(this.busy, 0.3)
            this.hitReactCd = 0.55
        }
    }

    // elige la animacion de golpe segun de donde viene el disparo
    hitAnimFor(fromPos)
    {
        const yaw = this.model.rotation.y - this.facingOffset
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x)
        const dx = fromPos.x - this.model.position.x, dz = fromPos.z - this.model.position.z
        const dotF = dx * fwd.x + dz * fwd.z
        const dotR = dx * right.x + dz * right.z
        if(Math.abs(dotR) > Math.abs(dotF))
            return dotR > 0 ? 'hit_right' : 'stagger_right'
        return dotF > 0 ? 'hit_front' : 'hit_back'
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
        if(this.hitReactCd > 0)
            this.hitReactCd -= delta
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
        // (el dano se escanea en orden 5, ver damageScan)
        this.updateHealthBar()
        this.processStep(delta)

        // ---- orientacion segun estado ----
        if(this.state === 'guard')
            this.model.rotation.y = this.baseYaw + Math.sin(this.game.ticker.elapsed * 0.35) * 0.28   // vigila de frente (barrido leve)
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
                const pdist = this.playerPos.distanceTo(this.model.position)

                // perder al jugador SOLO si escapa de verdad (lejos del frente de pelea)
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

                // RE-ENGANCHE: si te empuja lejos o te mueves, CORRE hasta ti para seguir
                // peleando. El frente de pelea (ancla) te sigue: no se rinde por empujarte.
                if(!this.move && this.busy <= 0 && this.queue.length === 0 && pdist > 11)
                {
                    if(this.current !== this.actions['walk'])
                    {
                        const wa = this.play('walk', { fade: 0.15 })
                        if(wa) wa.timeScale = 1.9
                    }
                    this.moveToward(this.playerPos, this.huntSpeed, delta)
                    this.anchor.lerp(this.model.position, Math.min(1, delta * 2))
                }
                else
                {
                    // cerebro: encadenar combos con pausas aleatorias (cuando esta en rango)
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
