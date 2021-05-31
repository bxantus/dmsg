package com.bxantus.messaging

@ExperimentalStdlibApi
class RemoteObject(val handle:UInt, private val conn:MessagingConnection) {
    fun call(vararg args:Any?) {

    }

    fun callMethod(method:String, vararg args:Any?) {

    }
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
            return handle
        }

    fun getObject(handle:UInt) = objectsByHandle[handle]
}