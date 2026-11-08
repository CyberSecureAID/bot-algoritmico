import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Concesionario DecFreedom.
 * Una lengua de arena integrada al terreno (material de suelo del juego) en el borde
 * de agua, con TODOS los autos (en el suelo) y TODAS las naves (flotando bajito con
 * sombra y fuego trasero). Faroles del propio mapa. Modulo ADITIVO y a prueba de fallos.
 */
export class Concesionario
{
    constructor()
    {
        this.game = Game.getInstance()

        this.center = new THREE.Vector3(40, 0, 80)
        this.topY = 0.35
        this.ships = []          // para animar flotacion y fuego

        this.carNames = [ 'SUV', 'Cop', 'Taxi', 'NormalCar1', 'NormalCar2', 'SportsCar', 'SportsCar2' ]
        this.shipNames = [ 'Striker', 'Dispatcher', 'Insurgent', 'Executioner', 'Omen', 'Imperial', 'Zenith', 'Pancake', 'Challenger', 'Spitfire' ]

        try
        {
            this.setGroup()
            this.setLights()
            this.setSandPad()
            this.loadBaseCar()
            this.loadCars()
            this.loadShips()
            this.loadLanterns()

            this.tickCallback = () => { try { this.update() } catch(e) {} }
            this.game.ticker.events.on('tick', this.tickCallback, 8)
        }
        catch(error)
        {
            console.warn('[Concesionario] no se pudo construir:', error)
        }
    }

    setGroup()
    {
        this.group = new THREE.Group()
        this.group.position.copy(this.center)
        this.game.scene.add(this.group)
    }

    // Luz solo para que los vehiculos (materiales con textura) se iluminen y conserven su color.
    // Los materiales propios del juego (nodos) ignoran estas luces, asi que no cambian.
    setLights()
    {
        const hemi = new THREE.HemisphereLight('#ffe9c8', '#5a4a3a', 2.1)
        this.game.scene.add(hemi)
        const sun = new THREE.DirectionalLight('#fff2df', 2.4)
        sun.position.set(this.center.x + 30, 50, this.center.z + 20)
        this.game.scene.add(sun)
        this.vehicleLights = [ hemi, sun ]
    }

    // Lengua de arena con el material de suelo del juego
    setSandPad()
    {
        const sand = new MeshDefaultMaterial({ colorNode: color('#d8a46a') })
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(24, 21, 4, 40), sand)
        pad.position.y = this.topY - 2
        pad.scale.z = 0.72
        this.group.add(pad)

        const grass = new MeshDefaultMaterial({ colorNode: color('#7fae4e') })
        const ring = new THREE.Mesh(new THREE.TorusGeometry(23, 0.7, 8, 48), grass)
        ring.rotation.x = Math.PI * 0.5
        ring.position.y = this.topY - 0.15
        ring.scale.z = 0.72
        this.group.add(ring)
    }

    fitAndPlace(model, x, z, targetLen, y, faceOut)
    {
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3(); box.getSize(size)
        const scale = targetLen / (Math.max(size.x, size.z) || 1)
        model.scale.setScalar(scale)
        const box2 = new THREE.Box3().setFromObject(model)
        const cx = (box2.min.x + box2.max.x) / 2
        const cz = (box2.min.z + box2.max.z) / 2
        model.position.set(x - cx, (y !== undefined ? y : this.topY) - (y !== undefined ? (box2.min.y + box2.max.y) / 2 : box2.min.y), z - cz)
        model.rotation.y = faceOut ? 0 : Math.PI
        model.traverse(c => { if(c.isMesh){ c.castShadow = true; c.receiveShadow = true } })
        this.group.add(model)
        return model
    }

    // sombra falsa (disco oscuro) bajo un vehiculo flotante
    addShadowBlob(x, z, r)
    {
        const mat = new MeshDefaultMaterial({ colorNode: color('#4a3420') })
        const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat)
        blob.rotation.x = -Math.PI * 0.5
        blob.position.set(x, this.topY + 0.03, z)
        blob.scale.z = 0.8
        this.group.add(blob)
        return blob
    }

    loadCars()
    {
        const base = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/'
        const loader = new GLTFLoader()
        const rows = [ { z: -9, count: 4, face: true }, { z: -3.5, count: 3, face: false } ]
        let i = 0
        for(const row of rows)
            for(let k = 0; k < row.count; k++)
            {
                if(i >= this.carNames.length) break
                const name = this.carNames[i]
                const x = -9 + k * 6
                loader.load(`${base}cars/${name}.glb`,
                    (g) => { try { this.fitAndPlace(g.scene, x, row.z, 2.6, undefined, row.face) } catch(e){} },
                    undefined, (e) => console.warn('[Concesionario] auto', name, e))
                i++
            }
    }

    loadShips()
    {
        const base = (import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/'
        const loader = new GLTFLoader()
        const rows = [ { z: 4, count: 5 }, { z: 11, count: 5 } ]
        let i = 0
        for(const row of rows)
            for(let k = 0; k < row.count; k++)
            {
                if(i >= this.shipNames.length) break
                const name = this.shipNames[i]
                const x = (k - (row.count - 1) / 2) * 7
                const hoverY = this.topY + 2.6
                this.addShadowBlob(x, row.z, 2.4)
                loader.load(`${base}ships/${name}.glb`,
                    (g) => {
                        try {
                            const model = this.fitAndPlace(g.scene, x, row.z, 4.5, hoverY, true)
                            const flame = this.makeFlame()
                            flame.position.set(x, hoverY, row.z + 2.6)
                            this.group.add(flame)
                            this.ships.push({ model, flame, baseY: hoverY, phase: Math.random() * Math.PI * 2 })
                        } catch(e){}
                    },
                    undefined, (e) => console.warn('[Concesionario] nave', name, e))
                i++
            }
    }

    makeFlame()
    {
        const mat = new THREE.MeshBasicNodeMaterial({ colorNode: color('#ff7a1a'), transparent: true, opacity: 0.9 })
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 10), mat)
        flame.rotation.x = -Math.PI * 0.5   // apunta hacia atras (-z local -> +z)
        return flame
    }

    loadBaseCar()
    {
        try {
            const src = this.game.resources && this.game.resources.vehicle && this.game.resources.vehicle.scene
            if(!src) return
            this.fitAndPlace(src.clone(true), 9, -9, 2.6, undefined, true)
        } catch(e) { console.warn('[Concesionario] carro base', e) }
    }

    loadLanterns()
    {
        try {
            const src = this.game.resources && this.game.resources.lanternsModel && this.game.resources.lanternsModel.scene
            if(!src) return
            for(const [x, z] of [ [-20, -10], [20, -10], [-20, 12], [20, 12], [0, 15] ])
            {
                const lantern = src.clone(true)
                const box = new THREE.Box3().setFromObject(lantern)
                const size = new THREE.Vector3(); box.getSize(size)
                lantern.scale.setScalar(3 / (size.y || 1))
                const b2 = new THREE.Box3().setFromObject(lantern)
                lantern.position.set(x, this.topY - b2.min.y, z)
                try { this.game.materials.updateObject(lantern) } catch(e) {}
                this.group.add(lantern)
            }
        } catch(e) { console.warn('[Concesionario] faroles', e) }
    }

    update()
    {
        const t = this.game.ticker.elapsed || (performance.now() / 1000)
        for(const s of this.ships)
        {
            const bob = Math.sin(t * 1.4 + s.phase) * 0.18
            s.model.position.y = s.baseY + bob
            s.flame.position.y = s.baseY + bob
            const f = 0.7 + Math.abs(Math.sin(t * 20 + s.phase)) * 0.5
            s.flame.scale.set(1, f, 1)
        }
    }

    destroy()
    {
        if(this.tickCallback) this.game.ticker.events.off('tick', this.tickCallback)
        if(this.group) this.group.removeFromParent()
    }
}
