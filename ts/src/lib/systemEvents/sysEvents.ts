import { Disposable } from "../base.ts"

export interface BackEvent {
    on(handler:()=>void):Disposable
}

export interface ISystemEvents {
    back:BackEvent

    state: {
        canGoBack:boolean
    }
}