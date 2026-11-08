import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import gsap from 'gsap'

/**
 * DecFreedom - Personajes jugables (hombres y mujeres, sin peces).
 * - Pantalla de seleccion antes de abrir el mundo: todos aparecen con su sombra.
 * - Al tocar uno: efecto de iluminacion/seleccion, se centra y se entra al mundo con el.
 * - Por defecto se controla el PERSONAJE (caminar). Si se da click al carrito, se
 *   controla el carrito y el personaje desaparece. Tecla F (o doble-tap) para volver.
 * - Animacion 100% procedural sobre un esqueleto limpio (idle / walk / run).
 */
export class Characters
{
    static NAMES = [ 'Witch', 'Formal', 'Casual', 'Suit', 'Punk', 'SciFi', 'Adventurer', 'Soldier', 'Worker', 'Medieval' ]

    constructor()
    {
        this.game = Game.getInstance()

        // escala: el GLB mide ~200u de alto; el carro ~3u. Persona objetivo ~2u.
        this.scale = 0.0105
        this.faceOffset = Math.PI           // el modelo mira a -Z; +PI para mirar bien
        this.moveSpeed = 7.5               // u/seg caminando
        this.runSpeed = 13.5
        this.turnSpeed = 10

        this.loader = new GLTFLoader()
        this.cache = new Map()             // name -> gltf
        this.rosterItems = []              // seleccion
        this.active = null                 // instancia controlada
        this.mode = 'none'                 // none | selecting | character | vehicle
        this.selectedName = null
        this._tmpV = new THREE.Vector3()
        this._ray = new THREE.Raycaster()
        this._down = new THREE.Vector3(0, -1, 0)

        this.groundMeshes = []

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 7) // despues del Player (6)

        // precargar en segundo plano para que la seleccion este lista
        this.preload()
    }

    // ---- carga ------------------------------------------------------------
    url(name){ return `./characters/${name}.glb` }

    load(name)
    {
        if(this.cache.has(name))
            return Promise.resolve(this.cache.get(name))
        if(this._loading && this._loading.has(name))
            return this._loading.get(name)
        if(!this._loading) this._loading = new Map()
        const promise = new Promise((resolve) =>
        {
            let done = false
            const finish = (v) => { if(done) return; done = true; if(v) this.cache.set(name, v); resolve(v) }
            this.loader.load(this.url(name), (gltf) => finish(gltf), undefined, () => finish(null))
        })
        this._loading.set(name, promise)
        return promise
    }

    // carga en paralelo, sin bloquear
    preload()
    {
        return Promise.all(Characters.NAMES.map(n => this.load(n)))
    }

    // construye una instancia visual a partir del GLB
    build(name)
    {
        const gltf = this.cache.get(name)
        if(!gltf) return null

        // clon con esqueleto re-vinculado correctamente
        const root = skeletonClone(gltf.scene)

        root.traverse((o) =>
        {
            if(o.isMesh || o.isSkinnedMesh)
            {
                o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
                if(o.material) o.material = o.material.clone() // material propio por instancia
            }
        })

        // wrapper para escala + orientacion
        const wrapper = new THREE.Group()
        wrapper.add(root)
        wrapper.scale.setScalar(this.scale)

        // mapa de huesos (nombre base sin sufijo) + pose de reposo
        const bones = {}
        const rest = {}
        root.traverse((o) =>
        {
            if(o.isBone)
            {
                const base = o.name.replace(/_\d+$/, '')
                bones[base] = o
                rest[base] = o.rotation.clone()
            }
        })

        return { name, wrapper, root, bones, rest, phase: 0, speed: 0, facing: 0, targetFacing: 0 }
    }

    // ---- animacion procedural --------------------------------------------
    applyPose(inst, mode, t, moveAmount = 1)
    {
        const { bones, rest } = inst
        for(const k in rest) if(bones[k]) bones[k].rotation.copy(rest[k])

        const add = (n, ax, v) => { const b = bones[n]; if(b) b.rotation[ax] += v }
        const ph = t * Math.PI * 2

        // reposo: brazos abajo (eje X local, ambos negativos)
        const armDown = 1.3
        add('UpperArmL', 'x', -armDown); add('UpperArmR', 'x', -armDown)
        add('LowerArmL', 'x', -0.15);   add('LowerArmR', 'x', -0.15)

        if(mode === 'walk' || mode === 'run')
        {
            const run = mode === 'run'
            const amp = (run ? 0.95 : 0.6) * moveAmount
            const knee = (run ? 1.15 : 0.75) * moveAmount
            const arm = (run ? 0.85 : 0.5) * moveAmount

            add('UpperLegL', 'x',  amp * Math.sin(ph))
            add('UpperLegR', 'x',  amp * Math.sin(ph + Math.PI))
            add('LowerLegL', 'x', -knee * Math.max(0, -Math.sin(ph - 0.6)))
            add('LowerLegR', 'x', -knee * Math.max(0, -Math.sin(ph + Math.PI - 0.6)))
            add('UpperArmL', 'x',  arm * Math.sin(ph + Math.PI))
            add('UpperArmR', 'x',  arm * Math.sin(ph))
            add('Torso', 'y', 0.12 * Math.sin(ph))
            add('Abdomen', 'y', 0.08 * Math.sin(ph))
            if(run) add('Torso', 'x', 0.18) // inclinacion al correr
        }
        else // idle
        {
            add('UpperArmL', 'x', 0.05 * Math.sin(t * Math.PI * 2))
            add('UpperArmR', 'x', 0.05 * Math.sin(t * Math.PI * 2 + 0.4))
            add('Chest', 'x', 0.02 * Math.sin(t * Math.PI * 2)) // respirar
        }
    }

    // ---- suelo ------------------------------------------------------------
    collectGround()
    {
        this.groundMeshes = []
        const push = (m) => { if(m && (m.isMesh)) this.groundMeshes.push(m) }
        push(this.game.terrain?.mesh)
        push(this.game.world?.floor?.mesh)
        if(this.game.world?.floor?.slabs?.mesh) push(this.game.world.floor.slabs.mesh)
    }

    groundHeight(x, z, fallback = 0)
    {
        if(!this.groundMeshes.length) this.collectGround()
        if(this.groundMeshes.length)
        {
            this._ray.set(this._tmpV.set(x, 60, z), this._down)
            const hits = this._ray.intersectObjects(this.groundMeshes, true)
            if(hits.length) return hits[0].point.y
        }
        return fallback
    }

    // ---- seleccion --------------------------------------------------------
    startSelection(onSelect)
    {
      this._selStarted = true
      try {
        this.onSelect = onSelect
        this.mode = 'selecting'
        this.rosterItems = []

        const center = this.game.reveal.position.clone()
        const n = Characters.NAMES.length
        const spacing = 1.45
        const perRow = 5
        const rows = Math.ceil(n / perRow)

        // azimut real de la camara (para que miren hacia ella y se alineen en arco)
        const cam = this.game.view.camera.position
        const foc = this.game.view.focusPoint.position
        const camAz = Math.atan2(cam.x - foc.x, cam.z - foc.z) // direccion camara->personaje
        const sideX = Math.cos(camAz), sideZ = -Math.sin(camAz)  // "derecha" de la camara
        this._selLayout = { center, spacing, perRow, rows, camAz, sideX, sideZ }

        // agrandar el circulo revelado para que quepan todos con su sombra
        try {
            gsap.to(this.game.reveal.distance, { value: 8, duration: 1.2, ease: 'power2.out', overwrite: true })
        } catch(e) {}
        // fijar el foco de camara al centro del roster (si no, sigue al carro)
        this.game.view.focusPoint.isTracking = true
        this.game.view.focusPoint.magnet.active = false // que no jale el foco a otro lado
        // alejar un poco para que quepan todos sin cortarse
        try {
            gsap.to(this.game.view.zoom, { baseRatio: 0.62, smoothedRatio: 0.62, duration: 1.2, ease: 'power2.out', overwrite: true })
        } catch(e) {}

        // cargar y colocar cada uno en paralelo (no se bloquea si uno tarda)
        Characters.NAMES.forEach((name, i) =>
        {
            this.load(name).then((gltf) =>
            {
                if(!gltf || this.mode !== 'selecting') return
                try { this.placeRosterItem(name, i) }
                catch(e) { this._selErr = 'place:' + String(e && e.stack || e) }
            })
        })
      } catch(e) { this._selErr = 'start:' + String(e && e.stack || e) }
    }

    placeRosterItem(name, i)
    {
        const { center, spacing, perRow, rows, camAz } = this._selLayout
        const inst = this.build(name)
        if(!inst) return

        const col = i % perRow
        const row = Math.floor(i / perRow)
        // eje "derecha de camara" = perpendicular al azimut; fila al frente/atras = a lo largo del azimut
        const sideX = Math.cos(camAz), sideZ = -Math.sin(camAz)      // perpendicular
        const fwdX = Math.sin(camAz), fwdZ = Math.cos(camAz)          // camara->escena
        const offSide = (col - (perRow - 1) / 2) * spacing
        const offFwd = (row - (rows - 1) / 2) * spacing * 1.3 - 0.4   // filas; fila 0 mas cerca de camara

        const px = center.x + sideX * offSide + fwdX * offFwd
        const pz = center.z + sideZ * offSide + fwdZ * offFwd
        const py = this.groundHeight(px, pz, center.y)

        inst.wrapper.position.set(px, py, pz)
        inst.wrapper.rotation.y = camAz + this.faceOffset   // mirar hacia la camara
        this.applyPose(inst, 'idle', Math.random())
        this.game.scene.add(inst.wrapper)

        const sphere = new THREE.Sphere(new THREE.Vector3(px, py + 1, pz), 1.1)
        const intersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: sphere,
            onClick: () => this.choose(name),
            onEnter: () => { inst.hover = true; gsap.to(inst.wrapper.scale, { x: this.scale * 1.12, y: this.scale * 1.12, z: this.scale * 1.12, duration: 0.2, overwrite: true }) },
            onLeave: () => { inst.hover = false; gsap.to(inst.wrapper.scale, { x: this.scale, y: this.scale, z: this.scale, duration: 0.2, overwrite: true }) }
        })
        this.rosterItems.push({ inst, intersect })
    }

    choose(name)
    {
        if(this.mode !== 'selecting') return
        this.selectedName = name

        // iluminar el elegido, desvanecer los demas
        const chosen = this.rosterItems.find(r => r.inst.name === name)
        for(const { inst, intersect } of this.rosterItems)
        {
            this.game.rayCursor.removeIntersect(intersect)
            if(inst.name === name)
            {
                gsap.to(inst.wrapper.scale, { x: this.scale * 1.3, y: this.scale * 1.3, z: this.scale * 1.3, duration: 0.5, ease: 'back.out(2)' })
                this.illuminate(inst)
            }
            else
            {
                gsap.to(inst.wrapper.position, { y: inst.wrapper.position.y - 0.3, duration: 0.6, ease: 'power2.in' })
                this.fadeOut(inst, () => { inst.wrapper.removeFromParent() })
            }
        }

        // continuar al mundo
        gsap.delayedCall(0.9, () =>
        {
            if(chosen) chosen.inst.wrapper.removeFromParent()
            this.spawnControlled(name)
            if(typeof this.onSelect === 'function') this.onSelect(name)
        })
    }

    illuminate(inst)
    {
        inst.wrapper.traverse((o) =>
        {
            if((o.isMesh || o.isSkinnedMesh) && o.material)
            {
                const m = o.material
                if('emissive' in m)
                {
                    m.emissive = new THREE.Color('#fff2c0')
                    m.emissiveIntensity = 0
                    gsap.to(m, { emissiveIntensity: 0.9, duration: 0.3, yoyo: true, repeat: 1, overwrite: true })
                }
            }
        })
    }

    fadeOut(inst, done)
    {
        const mats = []
        inst.wrapper.traverse((o) => { if((o.isMesh || o.isSkinnedMesh) && o.material){ o.material.transparent = true; mats.push(o.material) } })
        const dummy = { o: 1 }
        gsap.to(dummy, { o: 0, duration: 0.6, overwrite: true, onUpdate: () => { for(const m of mats) m.opacity = dummy.o }, onComplete: done })
    }

    // ---- juego ------------------------------------------------------------
    spawnControlled(name)
    {
        const inst = this.build(name)
        const r = this.game.reveal.position.clone()
        const py = this.groundHeight(r.x, r.z, r.y)
        inst.wrapper.position.set(r.x, py, r.z)
        inst.facing = inst.targetFacing = 0
        this.game.scene.add(inst.wrapper)
        this.active = inst
        this.mode = 'character'

        // el carro NO se controla por defecto
        this.game.player.state = 2 // Player.STATE_LOCKED

        // camara sigue al personaje
        this.game.view.focusPoint.isTracking = true

        this.setupSwitchInputs()
    }

    setupSwitchInputs()
    {
        if(this._switchReady) return
        this._switchReady = true

        // tecla F: alternar carro/personaje
        try {
            this.game.inputs.addActions([
                { name: 'toggleCharacter', categories: [ 'wandering' ], keys: [ 'Keyboard.KeyF' ] },
            ])
        } catch(e) {}
        this.game.inputs.events.on('toggleCharacter', (action) =>
        {
            if(action && !action.active) return // solo al presionar, no al soltar
            if(this.mode === 'character') this.enterVehicle()
            else if(this.mode === 'vehicle') this.exitVehicle()
        })

        // click en el carro -> controlar carro
        const vehicle = this.game.physicalVehicle
        this.carIntersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(vehicle.position.clone(), 2.2),
            onClick: () => { if(this.mode === 'character') this.enterVehicle() }
        })
    }

    enterVehicle()
    {
        if(!this.active) return
        this.mode = 'vehicle'
        this.active.wrapper.visible = false
        this.game.player.state = 1 // STATE_DEFAULT
    }

    exitVehicle()
    {
        if(!this.active) return
        this.mode = 'character'
        this.game.player.state = 2 // STATE_LOCKED
        // reaparece junto al carro
        const p = this.game.physicalVehicle.position
        const py = this.groundHeight(p.x, p.z, p.y)
        this.active.wrapper.position.set(p.x + 2.2, py, p.z)
        this.active.wrapper.visible = true
        this.game.view.focusPoint.isTracking = true
    }

    // ---- loop -------------------------------------------------------------
    update()
    {
        const inst = this.active
        const delta = this.game.ticker.delta

        // durante la seleccion, centrar la camara en el roster (sobrescribe al Player)
        if(this.mode === 'selecting' && this._selLayout)
        {
            // centrar el grupo en pantalla: la camara encuadra a la derecha del foco,
            // asi que corremos el foco a la izquierda del grupo
            const L = this._selLayout
            const fx = L.center.x - L.sideX * 3.2
            const fz = L.center.z - L.sideZ * 3.2
            this.game.view.focusPoint.trackedPosition.set(fx, 0, fz)
            if(this.game.tracks) this.game.tracks.focusPoint.set(fx, fz)
            // que todos miren hacia la camara, y respiren
            const cam = this.game.view.camera.position
            for(const { inst } of this.rosterItems)
            {
                const p = inst.wrapper.position
                inst.wrapper.rotation.y = Math.atan2(cam.x - p.x, cam.z - p.z) + this.faceOffset
                inst.phase = (inst.phase + delta * 0.25) % 1
                this.applyPose(inst, 'idle', inst.phase)
            }
        }

        if(this.mode === 'character' && inst)
        {
            const actions = this.game.inputs.actions
            let ix = 0, iz = 0
            if(actions.get('forward')?.active)  iz += 1
            if(actions.get('backward')?.active) iz -= 1
            if(actions.get('right')?.active)    ix += 1
            if(actions.get('left')?.active)     ix -= 1

            const nipple = this.game.inputs.nipple
            if(nipple?.active && nipple.progress > 0)
            {
                iz += Math.cos(nipple.angle ?? 0) * nipple.progress
                ix += Math.sin(nipple.angle ?? 0) * nipple.progress
            }

            const moving = (ix !== 0 || iz !== 0)
            const run = !!actions.get('boost')?.active

            if(moving)
            {
                // direccion relativa a la camara
                const theta = this.game.view?.spherical?.theta ?? 0.78
                const len = Math.min(1, Math.hypot(ix, iz))
                const dirX = (Math.sin(theta) * iz + Math.cos(theta) * ix)
                const dirZ = (Math.cos(theta) * iz - Math.sin(theta) * ix)
                const h = Math.hypot(dirX, dirZ) || 1
                const nx = dirX / h, nz = dirZ / h

                const speed = (run ? this.runSpeed : this.moveSpeed) * len
                inst.wrapper.position.x += nx * speed * delta
                inst.wrapper.position.z += nz * speed * delta
                inst.targetFacing = Math.atan2(nx, nz) + this.faceOffset
                inst.speed = speed
                inst.phase = (inst.phase + delta * (run ? 2.6 : 1.8)) % 1
            }
            else
            {
                inst.speed = 0
                inst.phase = (inst.phase + delta * 0.3) % 1
            }

            // suelo
            const py = this.groundHeight(inst.wrapper.position.x, inst.wrapper.position.z, inst.wrapper.position.y)
            inst.wrapper.position.y += (py - inst.wrapper.position.y) * Math.min(1, delta * 12)

            // giro suave
            let da = inst.targetFacing - inst.facing
            while(da > Math.PI) da -= Math.PI * 2
            while(da < -Math.PI) da += Math.PI * 2
            inst.facing += da * Math.min(1, delta * this.turnSpeed)
            inst.wrapper.rotation.y = inst.facing

            // animacion
            const mode = moving ? (run ? 'run' : 'walk') : 'idle'
            this.applyPose(inst, mode, inst.phase)

            // camara + tracks
            const pos = inst.wrapper.position
            this.game.view.focusPoint.trackedPosition.copy(pos)
            if(this.game.tracks) this.game.tracks.focusPoint.set(pos.x, pos.z)
        }

        // seguir al carro con el intersect mientras se juega a pie
        if(this.carIntersect && this.game.physicalVehicle)
            this.carIntersect.shape.center.copy(this.game.physicalVehicle.position)
    }
}
