import { Serializer, SerializerTypes, Deserializer } from '../src/messaging/serializer.ts'
import { MessagingConnection } from '../src/messaging/messagingConnection.ts'
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