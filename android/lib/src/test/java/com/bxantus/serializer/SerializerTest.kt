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

    @Test
    fun serializeDataClass() {
        data class AppleTree(val height:Int, val name:String, val numApples:Int) {
            private val dog = 10
        };
        val myTree = AppleTree(height = 10, name = "Eden", numApples = 100)
        val serializer = Serializer()
        serializer.writeValue(myTree)
        val des = Deserializer(serializer.buffer)
        assertEquals(SerializerTypes.Object.ordinal, des.getByte())
        val dict = des.getDictionary()
        assertEquals(myTree.height, dict["height"])
        assertEquals(myTree.name, dict["name"])
        assertEquals(myTree.numApples, dict["numApples"])
        assertEquals(10, dict["dog"])
    }
}