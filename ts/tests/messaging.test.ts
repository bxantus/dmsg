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
        this.sendOperations
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