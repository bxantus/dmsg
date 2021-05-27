package com.bxantus.messaging

import org.junit.Test

import org.junit.Assert.*
import com.bxantus.messaging.*

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
@ExperimentalStdlibApi
class SerializerTest {
    @Test
    fun serializeBasicTypes() {
        val serializer = Serializer()
        serializer.writeValue(101) // written as Int
        serializer.writeValue(20.5) // written as Double
        val des = Deserializer(serializer.buffer)
        assertEquals(des.getByte(), SerializerTypes.Int.ordinal)
        assertEquals(des.getInt(), 101)
        assertEquals(des.getByte(), SerializerTypes.Double.ordinal)
        assertEquals(des.getDouble(), 20.5, 0.001)
    }

    @Test
    fun serializeString() {
        val serializer = Serializer()
        serializer.writeValue("alma a fa alatt")
        serializer.writeValue("Árvíztűrő") // check utf8 encoding
        val desLenChecker = Deserializer(serializer.buffer)
        assertEquals(SerializerTypes.String.ordinal, desLenChecker.getByte() )
        assertEquals(15, desLenChecker.getUint16()) // len
        val des = Deserializer(serializer.buffer)
        assertEquals("alma a fa alatt", des.readValue() )
        assertEquals("Árvíztűrő", des.readValue() )
    }
}