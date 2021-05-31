import {
    decode as decodeBase64,
    encode as encodeBase64,
  } from "https://deno.land/std@0.97.0/encoding/base64.ts";
/**
 * Transport layer used to communicate between android app and the browser (javascript)
 * It builds on these two functionalities:
 *   * to send message on the android (java/kotlin side) we use `addJavascriptInterface()` to add a Kotlin class
 *     as receiver of messages
 *     NOTE: only primitive types, and array of primitive types can be sent, so probably we will convert the payload to
 *           string, or byte array (array of numbers)
 *     see: https://developer.android.com/guide/webapps/webview#BindingJavaScript
 *     see: https://stackoverflow.com/questions/2250917/passing-a-javascript-object-using-addjavascriptinterface-on-android
 *     
 *   * to send messages to the webview we can use the `evaluateJavascript()` method on the webview, this accepts the script
 *     only as a string, so serialization should be performed to string as well
 */

export interface AndroidInterface {
    connect(transportId:number):void
    onMessage(transportId:number, encodedMessage:string):void
    close(transportId:number):void
}

export class WebviewTransport {
    id:number
    constructor(private androidIntf:AndroidInterface) {
        this.id = nextTransportId++
        transports.set(this.id, this)
        androidIntf.connect(this.id)
    }

    messageReceiver:((message:Uint8Array) => void)|undefined = undefined
    send(message:Uint8Array[]) {
        if (message.length == 1) {
            this.androidIntf.onMessage(this.id, encodeBase64(message[0])) 
        } else {
            // todo: concat message chunks in one big array and encode that one
        }
    }

    receive(message:Uint8Array) {
        this.messageReceiver?.(message)
    }

    close() {
        transports.delete(this.id)
        this.androidIntf.close(this.id)
    }
}

const transports = new Map<number, WebviewTransport>()
let nextTransportId = 0
/**
 * This function will be made available in the global scope, for the android code to access
 */
export function webviewMessageReceiver(id:number, msg:string) {
    const transport = transports.get(id)
    if (!transport)
        throw new Error(`Transport with id of ${id} already closed`)
    transport.receive(decodeBase64(msg))
}

export function initializeConnection() {
    // from android, code should call: `window.__receive(id, "base64_encoded_message");`
    (window as any).__receive = webviewMessageReceiver
    // NOTE: receive should be used also for closing connections from the Android side
    //       in that case we could use a different signature, like only one object arg
    //       like `{close: <id>}`
}