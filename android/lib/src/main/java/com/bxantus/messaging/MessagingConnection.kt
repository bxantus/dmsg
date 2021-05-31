package com.bxantus.messaging

import java.nio.ByteBuffer

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

@ExperimentalStdlibApi
class MessagingConnection(private val transport:Transport, modules:Map<String, Module>? = null) {
    private val exportedObjects = ObjectStore()
    private val exportedModules = mutableMapOf<String, Module>()

    init {
        transport.messageReceiver = this::onMessageReceived // creates a bound function, with receiver
        if (modules != null)
            exportedModules.putAll(modules)
    }

    fun loadModule(uri:String) {

    }

    fun callObject() {

    }

    fun callObjectMethod() {

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
                ser.writeValue(mod)  // will return undef for unknown modules
                transport.send(ser.getBuffer())
            }
            MessageType.Call -> {
                val obj = des.readValue()
                val method = des.readValue()
                val args = des.readValue()
                // todo: should check for any exceptions during the call, and answer the request accordingly
                if (obj is Any && method is String) {
                    val res = obj::class.members.find { it.name == method }
                        ?.call(obj, *args as Array<out Any?>)
                    val ser = Serializer(exportedObjects)
                    ser.writeMessageHeader(MessageDirection.Response, msg, messageId)
                    ser.writeValue(res)
                    transport.send(ser.getBuffer())
                }
            }
        }
    }

    private fun processResponse(des:Deserializer, msg:MessageType, messageId:Int) {

    }
}