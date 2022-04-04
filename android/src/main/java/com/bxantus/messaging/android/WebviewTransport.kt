package com.bxantus.messaging.android

import android.webkit.ValueCallback
import com.bxantus.messaging.Transport
import java.nio.ByteBuffer
import android.webkit.WebView
import android.util.Base64
import android.webkit.JavascriptInterface
import com.bxantus.messaging.MessagingConnection
import com.bxantus.messaging.Module
import kotlinx.coroutines.MainScope

/**
 * Methods of this class will be called from the JS code.
 * Add it to your webView via the `addJavascriptInterface()` method
 * The JS Messaging API expects to access this interface under the name of `androidMessaging`.
 *
 * All initiated connections will serve the modules given via serveModule
 */
@ExperimentalStdlibApi
class MessagingInterface(val webView:WebView) {
    // NOTE: when connections can be manipulated from the kotlin side, then access to activeConnections should
    //       be synchronized (or locked)
    data class ConnectionAndTransport(val conn:MessagingConnection, val transport:WebViewTransport) {}

    private val activeConnections = mutableMapOf<Int, ConnectionAndTransport>()
    private val exportedModules = mutableMapOf<String, Module>()

    fun serveModule(uri:String, mod: Module) {
        exportedModules[uri] = mod
    }

    @JavascriptInterface
    fun connect(transportId:Int) {
        if (transportId in activeConnections) {
            // NOTE: conflicting transport creation
            //       should notify the other side that this hasn't succeeded
        } else {
            val trans = WebViewTransport(transportId, webView)
            // create a new messaging connection, and set it up with a list of modules
            val conn = MessagingConnection(trans, MainScope() , exportedModules)
            activeConnections[transportId] = ConnectionAndTransport(conn, trans)
        }
    }

    @JavascriptInterface
    fun onMessage(transportId:Int, encodedMessage:String) {
        val transport = activeConnections[transportId]?.transport
        // should run it on ui thread
        webView.post {
            transport?.receive(encodedMessage)
        }
    }

    @JavascriptInterface
    fun close(transportId:Int) {
        val connAndTrans = activeConnections.remove(transportId)
        connAndTrans?.transport?.close()
    }
}

class WebViewTransport internal constructor(val id:Int, private val webView: WebView) : Transport {

    override fun send(buf: ByteBuffer) {
        val encoded = Base64.encodeToString(buf.array(), 0, buf.limit(), Base64.NO_WRAP)
        val message = "__receive($id, '$encoded');"
        webView.evaluateJavascript(message, ValueCallback {  })
    }

    fun receive(message:String) {
        // message is a base64 encoded data coming from js
        val decoded = Base64.decode(message, Base64.DEFAULT)
        messageReceiver(ByteBuffer.wrap(decoded))
    }

    override var messageReceiver = fun(_: ByteBuffer){}
}