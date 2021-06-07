package com.bxantus.messaging

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