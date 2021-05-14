
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
class WebviewTransport {
    send(message:Uint8Array) {

    }

    receive(message:Uint8Array) {

    }
}

/**
 * This function will be made available in the global scope, for the android code to access
 */
function webviewMessageReceiver(msg:string) {

}

function initializeConnection() {
    // from android, code should call: `window.__receive("base64_encoded_message");`
    (window as any).__receive = webviewMessageReceiver
}