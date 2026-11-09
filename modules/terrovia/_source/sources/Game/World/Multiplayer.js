import { joinRoom, selfId } from 'trystero/nostr'
import { Game } from '../Game.js'
import { RemoteVehicle } from './RemoteVehicle.js'

/**
 * DecFreedom - Multijugador P2P (navegador a navegador, SIN servidor, SIN costo).
 *
 * Usa WebRTC via Trystero: los jugadores que entran al MISMO enlace entran a la misma
 * "sala" y se conectan directo entre si usando relays publicos GRATIS solo para
 * encontrarse (no pasa datos del juego por ningun servidor; eso va P2P).
 *
 * Version 1 (gratis): cada jugador VE a los demas moverse por el mapa, cada uno de un
 * color distinto. Sin dano todavia (eso sera la version de pago mas adelante).
 *
 * Lo que se envia: posicion + rotacion del carro, ~14 veces por segundo. El color de
 * cada quien se deduce de su id (no hace falta enviarlo).
 */
export class Multiplayer
{
    constructor()
    {
        this.game = Game.getInstance()

        this.enabled = false
        this.remotes = new Map()           // peerId -> RemoteVehicle
        this.sendAccumulator = 0
        this.sendInterval = 1 / 14         // ~14 Hz

        this.setup()

        if(this.enabled)
        {
            this.update = this.update.bind(this)
            this.game.ticker.events.on('tick', this.update, 9)   // despues del VisualVehicle (8)
        }
    }

    setup()
    {
        try
        {
            const config = { appId: 'decfreedom-terrovia' }

            // relays opcionales (para pruebas con un relay local). En produccion usa los
            // publicos por defecto de Trystero.
            const relays = import.meta.env.VITE_MP_RELAYS
            if(relays)
                config.relayConfig = { urls: relays.split(',').map((s) => s.trim()).filter(Boolean) }

            const roomName = import.meta.env.VITE_MP_ROOM || 'main'

            this.room = joinRoom(config, roomName)
            this.selfId = selfId

            this.moveAction = this.room.makeAction('mv')
            this.moveAction.onMessage = (data, ctx) => this.onRemoteMove(data, ctx && ctx.peerId)

            this.room.onPeerJoin = () => {}                       // el carro se crea al llegar su primer 'mv'
            this.room.onPeerLeave = (peerId) => this.removeRemote(peerId)

            this.enabled = true
        }
        catch(e)
        {
            this.enabled = false
            this.room = null
        }
    }

    onRemoteMove(data, peerId)
    {
        if(!peerId || !data || !this.game.world.visualVehicle)
            return

        let remote = this.remotes.get(peerId)
        if(!remote)
        {
            const colorName = this.game.world.visualVehicle.colorForPlayer(peerId).replace(/^player_/, '')
            remote = new RemoteVehicle(peerId, colorName)
            this.remotes.set(peerId, remote)
        }
        remote.setState(data.x, data.y, data.z, data.q)
    }

    removeRemote(peerId)
    {
        const remote = this.remotes.get(peerId)
        if(remote)
        {
            remote.destroy()
            this.remotes.delete(peerId)
        }
    }

    update()
    {
        const delta = this.game.ticker.delta

        // enviar mi estado ~14 Hz, solo cuando estoy manejando
        this.sendAccumulator += delta
        if(this.sendAccumulator >= this.sendInterval)
        {
            this.sendAccumulator = 0
            const v = this.game.physicalVehicle
            if(v && this.game.player?.state === 1)
            {
                const p = v.position
                const q = v.quaternion
                const r = (n) => Math.round(n * 100) / 100
                try
                {
                    this.moveAction.send({ x: r(p.x), y: r(p.y), z: r(p.z), q: [ r(q.x), r(q.y), r(q.z), r(q.w) ] })
                }
                catch(e) {}
            }
        }

        // interpolar los carros remotos
        for(const remote of this.remotes.values())
            remote.update(delta)
    }
}
