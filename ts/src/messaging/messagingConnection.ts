// all messages have a unique id, and a message type field
// supported message types:
//    * call:          [object:handle] [...args] -> this can be constructor as well
//      `object(...args)`
//    * loadModule:    [modulePath:string]

// Example scenario/messages
//    loadModule("android/positioning") // like a js module just implemented in kotlin/java
//         module will contain a list of exported objects: functions and constructable types
//         some kind of module implementor code could attach to this list and wrap to typescript interfaces
//         goal would be to intercept `obj.func(...args)` calls (with Proxy for ex) and transform them to async functions 
//    all element/property access is done via method calls (first draft), let's see how limiting is this
//    some object types will be fully serialized, this can help API writers... (like Geopos, options descriptor etc.)

export interface MessagingTransport {
    send(message:Uint8Array[]):void 
    messageReceiver:((message:Uint8Array) => void)|undefined
}

export enum MessageDirection { // both peers may send loadModule, and call requests to each other, also responses as well
    Request,
    Response
}

export enum MessageTypes {
    LoadModule,
    Call,
}

export class MessagingConnection {
    constructor(private transport:MessagingTransport) {
        transport.messageReceiver = msg => this.onMessageReceived(msg)
    }

    close() { 
        // should close connection over the transport, and close pending requests
        // NOTE: probably will never reject the call promises, instead will return undefined (resolve them with undefined)
    }

    async loadModule(uri:string) {
        this.transport.send([new Uint8Array([MessageDirection.Request, MessageTypes.LoadModule, 0])]) // todo: real payload, use serializer
        return new Promise<any>((res, rej) => {
            // todo: store resolver, and trigger when onMessageReceived is called
        })
    }

    async callObject(obj:RemoteObj, argArray: any[]):Promise<any> {

    }

    async callObjectMethod(method:RemoteMethod, argArray: any[]):Promise<any> {

    }

    private onMessageReceived(message:Uint8Array) {

    }

    private nextMessageId = 0
    private exportedObjects = new Map<object, number>()
    private exportedObjectIds = new Map<number, object>()
}


class RemoteObj extends Function { // should be callable, otherwise apply won't work
    id:number
    conn:MessagingConnection
    constructor(initializer:{id:number, conn:MessagingConnection}) {
        super()
        this.id = initializer.id
        this.conn = initializer.conn
    }
}

class RemoteMethod extends Function {
    obj:RemoteObj
    prop:string|symbol
    constructor(initializer:{obj:RemoteObj, prop:string|symbol}) {
        super()
        this.obj = initializer.obj
        this.prop = initializer.prop
    }
}
/**
 * Proxy traps for a remote object from peer
 */
class RemoteObjectTraps {
    apply(target:RemoteObj, thisArg: any, argArray: any[]) {
        return target.conn.callObject(target, argArray)
    }

    get(target: RemoteObj, p: string | symbol, receiver: any): any {
        // can't differentiate between prop access or method call, so first time all props will be represented as methods
        return new Proxy(new RemoteMethod({obj:target, prop:p}), new RemotePropertyTraps())
    } 
    construct(target: RemoteObj, argArray: any[], newTarget: Function): object {
        // todo: could return an object which refers to the return value of the construct message sent
        //       over the network, this would avoid the await after calling new module.MyKutya()
        //       but currently the simplest solution is to return a promise
        return target.conn.callObjectMethod(new RemoteMethod({obj:target, prop:"constructor"}), argArray)
    }
}

class RemotePropertyTraps {
    apply(target:RemoteMethod, thisArg: any, argArray: any[]) {
        return target.obj.conn.callObjectMethod(target, argArray)
    }
    get(target: RemoteMethod, p: string | symbol, receiver: any): any {
        // todo: maybe should let function like props?
        return undefined // can't further query
    }
}