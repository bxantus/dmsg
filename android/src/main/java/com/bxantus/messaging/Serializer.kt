package com.bxantus.messaging

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.reflect.KFunction
import kotlin.reflect.KVisibility

enum class SerializerTypes {
    Undef,
    Bool,
    Int,
    Double,
    String,
    ObjectHandle,
    RemoteObjectHandle,
    Array,
    Object,  // an object consisting of key/value pairs
    Backref // back reference to an object/array already written in this stream (by idx.)
}

class Serializer(private val objectStore:ObjectStore) {
    companion object {
        const val BUFFER_SIZE = 4096
    }
    // todo: chaining buffers should be implemented to accommodate larger payloads
    private val buffer:ByteBuffer = ByteBuffer.allocate(BUFFER_SIZE)
    private var offset = 0
    private val objectsWritten = mutableMapOf<Any, UInt>()

    init {
        buffer.order(ByteOrder.BIG_ENDIAN)
    }

    /// Use this method to get the underlying buffer to send
    fun getBuffer():ByteBuffer {
        buffer.limit(offset)
        return buffer
    }

    fun writeMessageHeader(dir:MessageDirection, msg:MessageType, messageId:Int) {
        putByte((dir.ordinal shl 4) or msg.ordinal)
        putUint(messageId.toUInt())
    }

    fun writeValue(value:Any?) {
        when(value) {
            null, Unit -> putByte(SerializerTypes.Undef.ordinal);
            is Boolean -> {
                putByte(SerializerTypes.Bool.ordinal);
                putByte(if (value) 1 else 0)
            }
            is Double -> writeDouble(value)
            is Float -> writeDouble(value.toDouble())
            is Int -> writeInt(value)
            is Number -> writeInt(value.toInt()) // all other numbers written as int
            is String -> {
                putByte(SerializerTypes.String.ordinal)
                putString(value)
            }
            is Array<*> -> writeArray(value)
            // todo: should decide whether lists will be added as arrays
            is RemoteObject -> {
                putByte(SerializerTypes.RemoteObjectHandle.ordinal)
                putUint(value.handle)
            }
            is Module -> writeModule(value)
            is DataObject -> writeDataObject(value, value::class.java)
            else -> {
                // write data classes as objects
                if (value::class.isData) {
                    writeDataObject(value, value::class.java)
                } else {
                    // all other objects should be written as handle
                    putByte(SerializerTypes.ObjectHandle.ordinal)
                    putUint(objectStore.getHandle(value))
                }
            }
        }
    }

    fun writeInt(value:Int) {
        putByte(SerializerTypes.Int.ordinal)
        putInt(value)
    }

    fun writeDouble(value:Double) {
        putByte(SerializerTypes.Double.ordinal)
        putDouble(value)
    }

    fun putByte(value:Int) {
        buffer.put(incOffset(1), value.toByte())
    }

    fun putByte(value:UByte) {
        buffer.put(incOffset(1), value.toByte())
    }

    fun putInt(int:Int) {
        buffer.putInt(incOffset(4), int)
    }

    fun putUint(u:UInt) {
        buffer.putInt(incOffset(4), u.toInt())
    }

    fun putUint16(u:UShort) {
        buffer.putShort(incOffset(2), u.toShort())
    }

    fun putUint16(i:Int) {
        buffer.putShort(incOffset(2), i.toUInt().toShort())
    }

    fun putDouble(value:Double) {
        buffer.putDouble(incOffset(8), value)
    }

    fun putString(s:String) {
        val utf8Encoded = s.encodeToByteArray()
        putUint16(utf8Encoded.size)
        buffer.position(incOffset(utf8Encoded.size))
        buffer.put(utf8Encoded)
    }

    fun writeDataObject(obj:Any, cls:Class<*>) {
        if (writeIfBackref(obj)) return
        objectsWritten[obj] = objectsWritten.size.toUInt()
        putByte(SerializerTypes.Object.ordinal)
        putUint16(cls.declaredFields.size)
        for (mem in cls.declaredFields) {
            putString(mem.name)
            mem.isAccessible = true
            writeValue(mem.get(obj))
        }
    }

    fun writeModule(module:Module) {
        if (writeIfBackref(module)) return
        objectsWritten[module] = objectsWritten.size.toUInt()
        putByte(SerializerTypes.Object.ordinal)
        val cls = module::class.java
        val functions = module::class.members.filter { it is KFunction && it.visibility == KVisibility.PUBLIC } as List<KFunction<*>>
        putUint16(cls.declaredFields.size + functions.size)
        for (mem in cls.declaredFields) {
            putString(mem.name)
            mem.isAccessible = true
            writeValue(mem.get(module))
        }
        for (func in functions) {
            putString(func.name)
            writeValue(BoundMethod(module, func))
        }
    }

    fun writeArray(arr:Array<*>) {
        if (writeIfBackref(arr)) return
        objectsWritten[arr] = objectsWritten.size.toUInt()
        putByte(SerializerTypes.Array.ordinal)
        putUint16(arr.size)
        for (item in arr) {
            writeValue(item)
        }
    }

    private fun writeIfBackref(obj:Any):Boolean {
        val backRef = objectsWritten[obj]
        if (backRef != null) {
            putUint(backRef)
            return true
        }
        return false
    }

    private fun incOffset(amount:Int):Int {
        val oldOffset = offset
        offset += amount
        return oldOffset
    }
}

data class MessageHeader(val dir:MessageDirection, val msg:MessageType, val messageId:Int) {

}

// RemoteObjectFactory returns Any to ease testing, concrete RemoteObject type is not that important here
typealias RemoteObjectFactory = (handle:UInt) -> Any

class Deserializer(private val input:ByteBuffer, private val objectStore:ObjectStore, private val remoteObjectFactory: RemoteObjectFactory) {
    private var offset = 0
    private val objectsRead = mutableListOf<Any?>()
    init {
        // will use the buffer in little endian byte order
        input.order(ByteOrder.BIG_ENDIAN)
    }

    companion object  {
        val MsgDirectionVals = MessageDirection.values()
        val MsgTypeVals = MessageType.values()
    }

    fun readMessageHeader():MessageHeader {
        val dirAndType = getByte()
        val id = getInt()

        return MessageHeader( MsgDirectionVals[dirAndType shr 4], MsgTypeVals[dirAndType and 0xF], id)
    }

    fun readValue():Any? =
        when (val type = getByte()) {
            SerializerTypes.Undef.ordinal -> null
            SerializerTypes.Bool.ordinal -> getByte() != 0
            SerializerTypes.Int.ordinal -> getInt()
            SerializerTypes.Double.ordinal -> getDouble()
            SerializerTypes.String.ordinal -> getString()
            SerializerTypes.Array.ordinal -> getArray()
            SerializerTypes.Object.ordinal -> getDictionary()
            // remote object from the other side's point of view, this is one of our exported objects
            SerializerTypes.RemoteObjectHandle.ordinal -> objectStore.getObject(getUint())
            SerializerTypes.ObjectHandle.ordinal -> remoteObjectFactory(getUint())
            SerializerTypes.Backref.ordinal -> objectsRead[getInt()]
            else -> null
        }


    fun getByte() = input.get(incOffset(1)).toUByte().toInt()
    fun getUint16() = input.getShort(incOffset(2)).toUShort().toInt()
    fun getInt() = input.getInt(incOffset(4))
    fun getUint() = input.getInt(incOffset(4)).toUInt()
    fun getDouble() = input.getDouble(incOffset(8))


    fun getString():String {
        val len = getUint16()
        val bytesInUtf8 = ByteArray(len)
        input.position(incOffset(len))
        input.get(bytesInUtf8, 0, len)
        return bytesInUtf8.decodeToString()
    }

    fun getDictionary():MutableMap<String, Any?> {
        val len = getUint16()
        val dict = LinkedHashMap<String, Any?>(len)
        objectsRead.add(dict)
        for (idx in 1..len) {
            val name = getString()
            val value = readValue()
            dict[name] = value
        }
        return dict
    }

    fun getArray():Array<Any?> {
        val len = getUint16()
        val arr = arrayOfNulls<Any?>(len)
        objectsRead.add(arr)
        for (idx in 0 until len) {
            arr[idx] = readValue()
        }
        return arr
    }

    private fun incOffset(amount:Int):Int {
        val oldOffset = offset
        offset += amount
        return oldOffset
    }
}