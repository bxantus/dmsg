/// make function, usefull to make object literals from arrow functions
/// otherwise you have to wrap your literal in { return <obj> } 
export function make<T>(v:T) { return v }

export interface Disposable {
    dispose():void
}

export function dispose(...objects:(Disposable|Disposable[])[]) {
    for (const obj of objects) {
        if (obj instanceof Array) {
            for (const o of obj) o.dispose()
            obj.splice(0)
        } else obj.dispose()
    }
}