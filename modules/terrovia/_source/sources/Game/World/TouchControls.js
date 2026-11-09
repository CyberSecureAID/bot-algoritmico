import { Game } from '../Game.js'

/**
 * DecFreedom - Controles tactiles para movil (pensado en vertical / portrait).
 *
 *   - JOYSTICK a la izquierda: mover hacia los lados y hacia adelante.
 *   - Boton ACELERADOR abajo a la derecha (grande).
 *   - Boton DISPARAR a la derecha, ENCIMA del acelerador y mas chico (estilo Call of Duty).
 *
 * Se muestra solo en dispositivos tactiles y solo mientras se maneja el carro.
 * No toca el flujo de escritorio ni el del mando. Es autocontenido: crea su propio
 * DOM y su propio CSS (no depende de index.html ni del bundle de estilos).
 *
 * Como se conecta:
 *   - Escribe su estado en game.touchControls (steer, throttle, accelerate) y lo lee
 *     Player.updatePrePhysics (tiene prioridad sobre el nipple).
 *   - Dispara con la accion 'shoot' via una tecla sintetica 'Touch.shoot'.
 */
export class TouchControls
{
    constructor()
    {
        this.game = Game.getInstance()
        this.game.touchControls = this

        // estado que lee el Player
        this.active = false          // el esquema tactil esta al mando
        this.steer = 0               // -1 (izquierda) .. 1 (derecha)
        this.throttle = 0            // 0 .. 1 (joystick hacia adelante)
        this.accelerate = false      // boton acelerador
        this.shooting = false

        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
        if(!this.isTouch)
            return                   // en escritorio no hacemos nada

        this.joystick = { touchId: null, cx: 0, cy: 0, radius: 60 }

        this.addSyntheticShootKey()
        this.setStyles()
        this.setDom()
        this.bindJoystick()
        this.bindButtons()

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 0)
    }

    addSyntheticShootKey()
    {
        try {
            const shoot = this.game.inputs.actions.get('shoot')
            if(shoot && shoot.keys.indexOf('Touch.shoot') === -1)
                shoot.keys.push('Touch.shoot')
        } catch(e) {}
    }

    setStyles()
    {
        const css = /* css */`
        .dec-touch { position:fixed; inset:0; z-index:40; pointer-events:none;
            touch-action:none; -webkit-user-select:none; user-select:none; display:none; }
        .dec-touch.is-visible { display:block; }
        .dec-touch .dec-joy-base { position:absolute; left:26px; bottom:34px;
            width:140px; height:140px; border-radius:50%; pointer-events:auto;
            background:rgba(255,255,255,0.10); border:2px solid rgba(255,255,255,0.35);
            box-shadow:0 2px 14px rgba(0,0,0,0.35); }
        .dec-touch .dec-joy-knob { position:absolute; left:50%; top:50%;
            width:62px; height:62px; margin:-31px 0 0 -31px; border-radius:50%;
            background:rgba(255,255,255,0.55); border:2px solid rgba(255,255,255,0.8);
            box-shadow:0 2px 10px rgba(0,0,0,0.4); transition:transform .04s linear; }
        .dec-touch .dec-btn { position:absolute; right:30px; pointer-events:auto;
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            color:#fff; font-weight:700; font-family:inherit; text-transform:uppercase;
            box-shadow:0 2px 14px rgba(0,0,0,0.4); -webkit-tap-highlight-color:transparent; }
        .dec-touch .dec-btn.is-down { transform:scale(0.92); filter:brightness(1.25); }
        .dec-touch .dec-gas { bottom:34px; width:108px; height:108px; font-size:15px;
            background:rgba(80,200,120,0.30); border:2px solid rgba(120,240,160,0.9); }
        .dec-touch .dec-fire { bottom:162px; width:78px; height:78px; font-size:13px;
            background:rgba(240,90,90,0.32); border:2px solid rgba(255,130,130,0.95); }
        .dec-touch .dec-ic { width:26px; height:26px; fill:none; stroke:#fff; stroke-width:2.2; }
        `
        const style = document.createElement('style')
        style.setAttribute('data-dec-touch', '')
        style.textContent = css
        document.head.appendChild(style)
    }

    setDom()
    {
        const root = document.createElement('div')
        root.className = 'dec-touch'

        // joystick
        const base = document.createElement('div')
        base.className = 'dec-joy-base'
        const knob = document.createElement('div')
        knob.className = 'dec-joy-knob'
        base.appendChild(knob)

        // acelerador
        const gas = document.createElement('button')
        gas.className = 'dec-btn dec-gas'
        gas.innerHTML = '<svg class="dec-ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'

        // disparar
        const fire = document.createElement('button')
        fire.className = 'dec-btn dec-fire'
        fire.innerHTML = '<svg class="dec-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'

        root.appendChild(base)
        root.appendChild(gas)
        root.appendChild(fire)
        document.body.appendChild(root)

        this.el = { root, base, knob, gas, fire }
    }

    bindJoystick()
    {
        const base = this.el.base
        const knob = this.el.knob

        const rectCenter = () =>
        {
            const r = base.getBoundingClientRect()
            this.joystick.cx = r.left + r.width / 2
            this.joystick.cy = r.top + r.height / 2
            this.joystick.radius = r.width / 2
        }

        const move = (clientX, clientY) =>
        {
            let dx = clientX - this.joystick.cx
            let dy = clientY - this.joystick.cy
            const dist = Math.hypot(dx, dy)
            const max = this.joystick.radius
            if(dist > max) { dx = dx / dist * max; dy = dy / dist * max }
            knob.style.transform = `translate(${dx}px, ${dy}px)`
            this.steer = dx / max                       // derecha = +
            this.throttle = Math.max(0, -dy / max)      // arriba = adelante
        }

        const reset = () =>
        {
            this.joystick.touchId = null
            this.steer = 0
            this.throttle = 0
            knob.style.transform = 'translate(0px, 0px)'
        }

        base.addEventListener('touchstart', (e) =>
        {
            e.preventDefault()
            if(this.joystick.touchId !== null) return
            const t = e.changedTouches[0]
            this.joystick.touchId = t.identifier
            rectCenter()
            move(t.clientX, t.clientY)
        }, { passive: false })

        base.addEventListener('touchmove', (e) =>
        {
            e.preventDefault()
            for(const t of e.changedTouches)
                if(t.identifier === this.joystick.touchId)
                    move(t.clientX, t.clientY)
        }, { passive: false })

        const end = (e) =>
        {
            for(const t of e.changedTouches)
                if(t.identifier === this.joystick.touchId)
                    reset()
        }
        base.addEventListener('touchend', end)
        base.addEventListener('touchcancel', end)
    }

    bindButtons()
    {
        // acelerador
        const gas = this.el.gas
        const gasDown = (e) => { e.preventDefault(); this.accelerate = true; gas.classList.add('is-down') }
        const gasUp = (e) => { if(e) e.preventDefault(); this.accelerate = false; gas.classList.remove('is-down') }
        gas.addEventListener('touchstart', gasDown, { passive: false })
        gas.addEventListener('touchend', gasUp, { passive: false })
        gas.addEventListener('touchcancel', gasUp, { passive: false })

        // disparar (dispara la accion 'shoot' via tecla sintetica)
        const fire = this.el.fire
        const fireDown = (e) =>
        {
            e.preventDefault()
            this.shooting = true
            fire.classList.add('is-down')
            try { this.game.inputs.start('Touch.shoot') } catch(err) {}
        }
        const fireUp = (e) =>
        {
            if(e) e.preventDefault()
            this.shooting = false
            fire.classList.remove('is-down')
            try { this.game.inputs.end('Touch.shoot') } catch(err) {}
        }
        fire.addEventListener('touchstart', fireDown, { passive: false })
        fire.addEventListener('touchend', fireUp, { passive: false })
        fire.addEventListener('touchcancel', fireUp, { passive: false })
    }

    update()
    {
        // mostrar solo mientras se maneja el carro (durante la intro el estado es LOCKED)
        const driving = this.game.player?.state === 1
        const show = this.isTouch && driving

        if(show !== this.active)
        {
            this.active = show
            this.el.root.classList.toggle('is-visible', show)

            if(!show)
            {
                // soltar todo al ocultar
                this.steer = 0
                this.throttle = 0
                this.accelerate = false
                if(this.shooting) { this.shooting = false; try { this.game.inputs.end('Touch.shoot') } catch(e) {} }
                this.el.knob.style.transform = 'translate(0px, 0px)'
            }
        }
    }
}
