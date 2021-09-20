import { ISystemEvents } from "../sysEvents.ts"

class BackEvent {
    canGoBack:boolean = true

    on(handler:()=>void) {
        const keyEventHandler = (ev:KeyboardEvent) => {
            if (ev.key == "Backspace" && this.canGoBack) {
                handler()
                ev.preventDefault()
            }
        }

        window.addEventListener("keydown", keyEventHandler)
        return {
            dispose() { window.removeEventListener("keydown", keyEventHandler) }
        }
    }
}

export class SystemEvents implements ISystemEvents {
    back = new BackEvent
    state = new class {
        constructor(private sysEvents:SystemEvents) {}
        set canGoBack(val:boolean) { this.sysEvents.back.canGoBack = val }
        get canGoBack() { return this.sysEvents.back.canGoBack }
    }(this)
}