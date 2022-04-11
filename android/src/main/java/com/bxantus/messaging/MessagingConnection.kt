package com.bxantus.messaging

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import kotlin.reflect.KCallable
import kotlin.reflect.full.callSuspend

interface Transport {
    fun send(buf:ByteBuffer)
    var messageReceiver: (buf:ByteBuffer) -> Unit
    fun close() = Unit
}

open class Module : DataObject() {
}

enum class MessageDirection { // both peers may send loadModule, and call requests to each other, also responses as well
    Request,
    Response
}

enum class MessageType {
    LoadModule,
    Call,
}

class MessagingConnection(private val transport:Transport, private val coScope:CoroutineScope, modules:Map<String, Module>? = null) {
    private val exportedObjects = ObjectStore()
    private val exportedModules = mutableMapOf<String, Module>()
    private var nextMessageId = 0
    private val requests = mutableMapOf<Int, CompletableDeferred<Any?>>()

    init {
        transport.messageReceiver = this::onMessageReceived // creates a bound function, with receiver
        if (modules != null)
            exportedModules.putAll(modules)
    }

    fun loadModule(uri:String) {

    }

    fun callObjectAsync(obj:RemoteObject, vararg args:Any?):Deferred<Any?> {
        val ser = Serializer(exportedObjects)
        ser.writeMessageHeader(MessageDirection.Request, MessageType.Call, ++nextMessageId)
        ser.writeValue(obj)
        ser.writeValue(null) // method
        ser.writeValue(args)
        val result = CompletableDeferred<Any?>()
        requests[nextMessageId] = result
        transport.send(ser.getBuffer())
        return result
    }

    fun callObjectMethodAsync(obj:RemoteObject, method:String, vararg args:Any?):Deferred<Any?> {
        val ser = Serializer(exportedObjects)
        ser.writeMessageHeader(MessageDirection.Request, MessageType.Call, ++nextMessageId)
        ser.writeValue(obj)
        ser.writeValue(method)
        ser.writeValue(args)
        val result = CompletableDeferred<Any?>()
        requests[nextMessageId] = result
        transport.send(ser.getBuffer())
        return result
    }

    fun serveModule(uri:String, mod:Module) {
        exportedModules[uri] = mod
    }

    private fun onMessageReceived(buf:ByteBuffer) {
        val des = Deserializer(buf, exportedObjects) { RemoteObject(it, this) }
        val header = des.readMessageHeader()
        when (header.dir) {
            MessageDirection.Request -> processRequest(des, header.msg, header.messageId)
            MessageDirection.Response -> processResponse(des, header.msg, header.messageId)
        }
    }

    private fun processRequest(des:Deserializer, msg:MessageType, messageId:Int) {
        when (msg) {
            MessageType.LoadModule -> {
                val loadModule = des.readValue()
                val args = des.readValue() as Array<*> // should be an array with one element
                val ser = Serializer(exportedObjects)
                ser.writeMessageHeader(MessageDirection.Response, msg, messageId)
                val mod = exportedModules[args[0]]
                if (mod != null) ser.writeModule(mod)
                else ser.writeValue(null) // will return undef for unknown modules
                transport.send(ser.getBuffer())
            }
            MessageType.Call -> {
                val obj = des.readValue()
                val method = des.readValue()
                val args = des.readValue()  as Array<out Any?>
                fun sendCallResponse(res:Any?) {
                    val ser = Serializer(exportedObjects)
                    ser.writeMessageHeader(MessageDirection.Response, msg, messageId)
                    ser.writeValue(res)
                    transport.send(ser.getBuffer())
                }
                if (obj is Any && method is String) {
                    val member = obj::class.members.find { it.name == method } ?: return
                    callMemberAndSendResult(obj, member, args, ::sendCallResponse)

                } else if (obj is BoundMethod<*>) {
                    callMemberAndSendResult(obj.obj as Any, obj.method, args, ::sendCallResponse)
                }
            }
        }
    }

    private fun callMemberAndSendResult(obj:Any, member:KCallable<*>, args:Array<out Any?>, sendResult:(res:Any?)->Unit) {
        // todo: should check for any exceptions during the call, and answer the request accordingly
        if (member.isSuspend) {
            coScope.launch {
                val res = member.callSuspend(obj, *args)
                sendResult(res)
            }
        } else {
            val res = member.call(obj, *args)
            sendResult(res)
        }
    }

    private fun processResponse(des:Deserializer, msg:MessageType, messageId:Int) {
        when (msg) {
            MessageType.Call -> {
                val request = requests.remove(messageId)
                request?.complete(des.readValue())
            }
        }
    }
}