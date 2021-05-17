import { Serializer, SerializerTypes } from '../src/messaging/serializer.ts'
import { MessagingConnection } from '../src/messaging/messagingConnection.ts'
import { assertEquals } from "https://deno.land/std@0.96.0/testing/asserts.ts";

Deno.test("serialize string", ()=> {
    const exportedObjects = new Map<object, number>()
    const s = new Serializer(exportedObjects)
    s.writeValue("alma")
    const res = s.getData()
    assertEquals(res.length, 1) 
    const buf = res[0]
    assertEquals(buf.length, 7)
    assertEquals(buf[0], SerializerTypes.String)
    assertEquals(buf[2], 4)  // length
})