import { Serializer } from './serializer.ts'
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

export enum MessageType {
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
        const s = new Serializer(this.exportedObjects)
        s.writeMessageHeader(MessageDirection.Request, MessageType.LoadModule, ++this.nextMessageId)
        s.writeValue("loadModule")
        s.writeArray([uri])
        this.transport.send(s.getData()) 
        return this.addRequest(this.nextMessageId)
    }

    async callObject(obj:RemoteObj, argArray: any[]):Promise<any> {
        const s = new Serializer(this.exportedObjects)
        s.writeMessageHeader(MessageDirection.Request, MessageType.Call, ++this.nextMessageId)
        s.writeValue(obj)       // should be written as remote obj
        s.writeValue(undefined) // no method, call the object itself
        s.writeArray(argArray)
        return this.addRequest(this.nextMessageId)
    }

    async callObjectMethod(method:RemoteMethod, argArray: any[]):Promise<any> {
        const s = new Serializer(this.exportedObjects)
        s.writeMessageHeader(MessageDirection.Request, MessageType.Call, ++this.nextMessageId)
        s.writeValue(method.obj)       // should be written as remote obj
        s.writeValue(method.name) 
        s.writeArray(argArray)
        return this.addRequest(this.nextMessageId)
    }

    private onMessageReceived(message:Uint8Array) {

    }

    private addRequest(id:number) {
        let resolver:(val:any)=>any
        const promisedResponse = new Promise<any>((resolve, reject) => {
            resolver = resolve
        })
        this.pendingRequests.set(id, resolver!)
        return promisedResponse
    }

    private nextMessageId = 0
    private exportedObjects = new Map<object, number>()
    private exportedObjectsById = new Map<number, object>()
    // request id -> resolver mapping
    private pendingRequests = new Map<number, (val:any)=>any>()
}

export const MessagingSymbol = {
    RemoteObject : Symbol("RemoteObject"),
    RemoteObjectId: Symbol("RemoteObjectId"),
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
        switch (p) {
            case MessagingSymbol.RemoteObject: return true; // facilitating remoteObject check
            case MessagingSymbol.RemoteObjectId: return target.id;

            // can't differentiate between prop access or method call, so first time all props will be represented as methods
            default: return new Proxy(new RemoteMethod({obj:target, prop:p}), new RemotePropertyTraps())
        }
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