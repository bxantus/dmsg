// serialize messages in Uint8Array format
// all messages have a unique id, and a message type field
//
// supported message types:
//    * call:          [object:handle] [...args]
//      `object(...args)`
//    * callObjectPath [objpath:string] [...args]
//      `get(obj.path).call(...args)`
//    * get            [obj|objPath] [propName]
//    * construct      [object: handle] [...args] - object is a handle describing a class
//      `new ObjType(...args)`

// Example scenario/messages
//    loadModule("android/positioning") // like a js module just implemented in kotlin/java
//         module will contain a list of exported objects: functions and constructable types
//         some kind of module implementor code could attach to this list and wrap to typescript interfaces
//         goal would be to intercept `obj.func(...args)` calls (with Proxy for ex) and transform them to async functions 