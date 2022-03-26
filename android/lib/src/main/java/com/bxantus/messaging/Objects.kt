package com.bxantus.messaging

import kotlin.reflect.KFunction
import kotlin.reflect.full.callSuspend

@ExperimentalStdlibApi
class RemoteObject(val handle:UInt, private val conn:MessagingConnection) {
    fun callAsync(vararg args:Any?) = conn.callObjectAsync(this, *args)
    suspend fun call(vararg args:Any?) = conn.callObjectAsync(this, *args).await()
    fun callMethodAsync(method:String, vararg args:Any?) = conn.callObjectMethodAsync(this, method, *args)
    suspend fun callMethod(method:String, vararg args:Any?) = conn.callObjectMethodAsync(this, method, *args).await()
}

// contents of data objects are serialized as well as data classes
// derive from this class to serialize contents
open class DataObject {

}

class ObjectStore {
    private val objectsByHandle = mutableMapOf<UInt, Any>()
    private val handles = mutableMapOf<Any, UInt>()

    /**
     * If obj isn't already stored it will be added
     */
    fun getHandle(obj:Any) =
        handles.getOrPut(obj) {
            val handle = handles.size.toUInt()
            objectsByHandle[handle] = obj
            handle
        }

    fun getObject(handle:UInt) = objectsByHandle[handle]
}

/**
 * Method storing the associated this value.
 * Use the method member to query extra information about the method, like if it's a suspend function or not
 */
class BoundMethod<T>(val obj:T, val method:KFunction<T>) {
    fun call(vararg args:Any?) = method.call(obj, *args)
    suspend fun callSuspend(vararg args:Any?) = method.callSuspend(obj, *args)
}