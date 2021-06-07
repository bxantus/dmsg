import { Serializer, SerializerTypes, Deserializer } from '../src/messaging/serializer.ts'
import { MessagingConnection, MessageDirection, MessageType, MessagingSymbol } from '../src/messaging/messagingConnection.ts'
import { assertEquals } from "https://deno.land/std@0.96.0/testing/asserts.ts";
import ObjectStore from "../src/messaging/objectStore.ts"

Deno.test("serialize string value", ()=> {
    const exportedObjects = new ObjectStore()
    const s = new Serializer(exportedObjects)
    s.writeValue("alma")
    const res = s.getData()
    assertEquals(res.length, 1) 
    const buf = res[0]
    assertEquals(buf.length, 7)
    assertEquals(buf[0], SerializerTypes.String)
    assertEquals(buf[2], 4)  // length
})

Deno.test("read serialized string", ()=> {
    const exportedObjects = new ObjectStore()
    
    const s = new Serializer(exportedObjects)
    s.putString("alma")
    const buf = s.getData()[0]

    const myExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    const ds = new Deserializer(buf, myExportedObjects, onRemoteObject)
    assertEquals(ds.getString(), "alma")
})

Deno.test("write and read basic numeric types", ()=> {
    const exportedObjects = new ObjectStore()
    
    const s = new Serializer(exportedObjects)
    s.writeValue(100)    // type field + int value
    s.writeValue(5000.5) // type field + double value
    const buf = s.getData()[0]

    const myExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    const ds = new Deserializer(buf, myExportedObjects, onRemoteObject)
    assertEquals(ds.getByte(), SerializerTypes.Int)
    assertEquals(ds.getInt(), 100)
    assertEquals(ds.getByte(), SerializerTypes.Double)
    assertEquals(ds.getDouble(), 5000.5)
})

Deno.test("write basic array", ()=> {
    const exportedObjects = new ObjectStore()
    
    const s = new Serializer(exportedObjects)
    s.writeValue([100, 5000.5, "alma"])    
    const buf = s.getData()[0]

    const myExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    const ds = new Deserializer(buf, myExportedObjects, onRemoteObject)
    assertEquals(ds.getByte(), SerializerTypes.Array)
    assertEquals(ds.getUint16(), 3) // 3 elements
    assertEquals(ds.readValue(), 100)
    assertEquals(ds.readValue(), 5000.5)
    assertEquals(ds.readValue(), "alma")
})

Deno.test("write basic record", ()=> {
    const exportedObjects = new ObjectStore()
    
    const s = new Serializer(exportedObjects)
    s.writeValue({ int:100, double:5000.5, str:"alma"})    
    const buf = s.getData()[0]

    const myExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    const ds = new Deserializer(buf, myExportedObjects, onRemoteObject)
    assertEquals(ds.getByte(), SerializerTypes.Object)
    assertEquals(ds.getUint16(), 3) // 3 elements
    assertEquals(ds.getString(), "int")
    assertEquals(ds.readValue(), 100)
    assertEquals(ds.getString(), "double")
    assertEquals(ds.readValue(), 5000.5)
    assertEquals(ds.getString(), "str")
    assertEquals(ds.readValue(), "alma")
})

class TestTransportWithExpectations {
    send(message:Uint8Array[]):void {
        if (this.sendOperations < this.sendExpectations.length) {
            this.sendExpectations[this.sendOperations](message[0])
            ++this.sendOperations
        } else {
            throw new Error(`Oversaturated send() call. Expected at most ${this.sendExpectations.length} calls`)
        }
    }
    messageReceiver:((message:Uint8Array) => void)|undefined

    private sendExpectations:((buf:Uint8Array) => any)[] = []
    private sendOperations:number = 0

    expectOnSend(checker:(buf:Uint8Array) => any) {
        this.sendExpectations.push(checker)
    }

    /**
     * Call it at end of the test case to check that all sendExpectations are processed
     */
    verify() {
        if (this.sendOperations < this.sendExpectations.length) {
            throw new Error(`Expected at least ${this.sendExpectations.length} of send operations, Only received ${this.sendOperations}`)
        }
    }
}

Deno.test("loadModule simple", async ()=> {
    const testTransport = new TestTransportWithExpectations()
    const conn = new MessagingConnection(testTransport)
    
    const remoteExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    // setup expectations
    testTransport.expectOnSend(buf => {
        const ds = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = ds.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Request)
        assertEquals(header.type, MessageType.LoadModule)
        assertEquals(header.id, 1)
        const method = ds.readValue()
        assertEquals(method, "loadModule")
        const args = ds.readValue()
        assertEquals(args, ["test"])

        // simulate some response
        const s = new Serializer(remoteExportedObjects)
        s.writeMessageHeader(MessageDirection.Response, MessageType.LoadModule, 1)
        s.writeValue({ // simple module with some remote objects
            log(what:string) {
                console.log("Hello: ", what)
            },
            info: {
                version: 1.0,
                name: "test"
            }
        })
        testTransport.messageReceiver?.(s.getData()[0])
    })

    // excecise messaging
    const testModule = await conn.loadModule("test")
    // log should be a remote object
    assertEquals(testModule.log[MessagingSymbol.RemoteObject], true)
    assertEquals(testModule.log[MessagingSymbol.RemoteObjectId], 0)
    assertEquals(testModule.info, {version: 1.0, name:"test"})

    testTransport.verify()
})

Deno.test("remotecall object simple", async ()=> {
    // NOTE: for sake of easier understanding this test contains heavy copy paste from the previous loadModule one
    const testTransport = new TestTransportWithExpectations()
    const conn = new MessagingConnection(testTransport)
    
    const remoteExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    // setup expectations
    const testModuleSpec = { 
        log(what:string) {
            console.log("Hello: ", what)
            return what.length
        },
        info: {
            version: 2.0,
            name: "test"
        }
    }
    testTransport.expectOnSend(buf => { // loadModule
        // simulate some response
        const s = new Serializer(remoteExportedObjects)
        s.writeMessageHeader(MessageDirection.Response, MessageType.LoadModule, 1)
        s.writeValue(testModuleSpec)
        assertEquals(remoteExportedObjects.getObject(0), testModuleSpec.log) // log should be exported
        testTransport.messageReceiver?.(s.getData()[0])
    })
    testTransport.expectOnSend(buf => { // calling log("my dog")
        const ds = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = ds.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Request)
        assertEquals(header.type, MessageType.Call)
        assertEquals(header.id, 2)

        const obj = ds.readValue()
        const method = ds.readValue()
        const args = ds.readValue()

        assertEquals(obj, remoteExportedObjects.getObject(0))
        assertEquals(method, undefined)
        assertEquals(args, ["my dog"])
        
        const s = new Serializer(remoteExportedObjects)
        s.writeMessageHeader(MessageDirection.Response, MessageType.Call, 2)
        s.writeValue(obj.apply(obj, args)) // this should call log
        testTransport.messageReceiver?.(s.getData()[0])
    })

    // excecise messaging
    const testModule = await conn.loadModule("test")
    const lenMydog = await testModule.log("my dog")
    assertEquals(lenMydog, 6)
    testTransport.verify()
})

Deno.test("remotecall object method", async ()=> {
    // NOTE: for sake of easier understanding this test contains heavy copy paste from the previous loadModule one
    const testTransport = new TestTransportWithExpectations()
    const conn = new MessagingConnection(testTransport)
    
    const remoteExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }
    class Logger {
        log(what:string) {
            return `Logging: ${what}`
        }
    }
    // setup expectations
    const testModuleSpec = { 
        logger: new Logger,
        info: {
            version: 2.0,
            name: "test"
        }
    }
    testTransport.expectOnSend(buf => { // loadModule
        // simulate some response
        const s = new Serializer(remoteExportedObjects)
        s.writeMessageHeader(MessageDirection.Response, MessageType.LoadModule, 1)
        s.writeValue(testModuleSpec)
        assertEquals(remoteExportedObjects.getObject(0), testModuleSpec.logger) // logger should be exported
        testTransport.messageReceiver?.(s.getData()[0])
    })
    testTransport.expectOnSend(buf => { // calling logger.log("I can log")
        const ds = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = ds.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Request)
        assertEquals(header.type, MessageType.Call)
        assertEquals(header.id, 2)

        const obj = ds.readValue()
        const method = ds.readValue()
        const args = ds.readValue()

        assertEquals(obj, remoteExportedObjects.getObject(0))
        assertEquals(method, "log")
        assertEquals(args, ["I can log!"])
        
        const s = new Serializer(remoteExportedObjects)
        s.writeMessageHeader(MessageDirection.Response, MessageType.Call, 2)
        s.writeValue(obj[method].apply(obj, args)) // this should call log
        testTransport.messageReceiver?.(s.getData()[0])
    })

    // excecise messaging
    const testModule = await conn.loadModule("test")
    const logMsg = await testModule.logger.log("I can log!")
    assertEquals(logMsg, "Logging: I can log!")
    testTransport.verify()
})

Deno.test("receive remote obj call", ()=> {
    const testTransport = new TestTransportWithExpectations()
    const conn = new MessagingConnection(testTransport)
    
    const remoteExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }

    const exportedObjects:ObjectStore = (conn as any).exportedObjects // trick to access private prop of conn
    const ch = exportedObjects.getHandle((a:number, b:number) => a*b) // will export this callable object with handle of 0
    assertEquals(ch, 0)

    testTransport.expectOnSend(buf => { // response to our callable, with 100 * 10 = 1000
        const des = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = des.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Response)
        assertEquals(header.type, MessageType.Call)
        assertEquals(header.id, 1)

        const res = des.readValue()
        assertEquals(res, 1000)
    })
    // test --------------
    // send a remote obj request
    const reqSer = new Serializer(remoteExportedObjects) // request serializer
    reqSer.writeMessageHeader(MessageDirection.Request, MessageType.Call, 1)
    reqSer.putByte(SerializerTypes.RemoteObjectHandle);reqSer.putUint(0) // remote obj with id 0
    reqSer.writeValue(undefined) // method
    reqSer.writeValue([100, 10]) // args
    testTransport.messageReceiver?.(reqSer.getData()[0])

    testTransport.verify()
})

Deno.test("receive remote obj method call", ()=> {
    const testTransport = new TestTransportWithExpectations()
    const conn = new MessagingConnection(testTransport)
    
    const remoteExportedObjects = new ObjectStore()
    const onRemoteObject = (handle:number) => { return {remote:true, handle}  }

    const exportedObjects:ObjectStore = (conn as any).exportedObjects // trick to access private prop of conn
    class Calc {
        add(a:number, b:number) { return a + b }
        sub(a:number, b:number) { return a - b }
    }
    const calcHandle = exportedObjects.getHandle(new Calc()) // will export this calc object with handle of 0
    assertEquals(calcHandle, 0)

    testTransport.expectOnSend(buf => { // response to our calc add, with 100 + 10 = 110
        const des = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = des.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Response)
        assertEquals(header.type, MessageType.Call)
        assertEquals(header.id, 1)

        const res = des.readValue()
        assertEquals(res, 110)
    })

    testTransport.expectOnSend(buf => { // response to our calc sub, with 10 - 100 = -90
        const des = new Deserializer(buf, remoteExportedObjects, onRemoteObject)
        const header = des.readMessageHeader()
        assertEquals(header.dir, MessageDirection.Response)
        assertEquals(header.type, MessageType.Call)
        assertEquals(header.id, 2)

        const res = des.readValue()
        assertEquals(res, -90)
    })
    // test --------------
    // send remote.add(100, 10)
    const addSer = new Serializer(remoteExportedObjects) 
    addSer.writeMessageHeader(MessageDirection.Request, MessageType.Call, 1)
    addSer.putByte(SerializerTypes.RemoteObjectHandle);addSer.putUint(0) // remote obj with id 0
    addSer.writeValue("add") // method
    addSer.writeValue([100, 10]) // args
    testTransport.messageReceiver?.(addSer.getData()[0])

    // send remote.sub(10, 100)
    const subSer = new Serializer(remoteExportedObjects) 
    subSer.writeMessageHeader(MessageDirection.Request, MessageType.Call, 2)
    subSer.putByte(SerializerTypes.RemoteObjectHandle);subSer.putUint(0) // remote obj with id 0
    subSer.writeValue("sub") // method
    subSer.writeValue([10, 100]) // args
    testTransport.messageReceiver?.(subSer.getData()[0])

    testTransport.verify()
})