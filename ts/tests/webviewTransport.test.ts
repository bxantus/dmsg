import { assertEquals } from "https://deno.land/std@0.96.0/testing/asserts.ts";
import { WebviewTransport, AndroidInterface, webviewMessageReceiver } from "../src/messaging/android/webviewTransport.ts"
import {
    decode as decodeBase64,
    encode as encodeBase64,
  } from "https://deno.land/std@0.97.0/encoding/base64.ts";

Deno.test("webviewTransport send", ()=>{
    let messages:[number, string][] = []
    const mockAndroid:AndroidInterface = {
        connect(id) {},
        onMessage(id, msg) {
            messages.push([id, msg])
        },
        close(id) {

        }
    } 
    const trans = new WebviewTransport(mockAndroid)
    const msg = new Uint8Array([10, 20, 255, 237]) 
    trans.send([msg])
    assertEquals(messages[0][0], trans.id)
    assertEquals(decodeBase64(messages[0][1]), msg)

    trans.close()
})

Deno.test("webviewTransport receive", ()=> {
    const mockAndroid:AndroidInterface = {
        connect(id) {},
        onMessage(id, msg) {},
        close(id) {}
    }
    const trans = new WebviewTransport(mockAndroid)
    const received:Uint8Array[] = [] 
    trans.messageReceiver = buf => received.push(buf)

    const msg = new Uint8Array([10, 20, 255, 237]) 
    webviewMessageReceiver(trans.id, encodeBase64(msg))
    assertEquals(received[0], msg)
    trans.close()
})