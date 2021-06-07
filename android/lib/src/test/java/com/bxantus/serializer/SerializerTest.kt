package com.bxantus.messaging

import org.junit.Test

import org.junit.Assert.*
import com.bxantus.messaging.*
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.TestCoroutineScope
import kotlinx.coroutines.test.runBlockingTest
import java.lang.RuntimeException
import java.nio.ByteBuffer

@ExperimentalStdlibApi
class SerializerTest {
    val dummyRemoteObjectFactory = fun (_:UInt) = "Remote"

    @Test
    fun serializeBasicTypes() {
        val objStore = ObjectStore()
        val serializer = Serializer(objStore)
        serializer.writeValue(101) // written as Int
        serializer.writeValue(20.5) // written as Double
        val des = Deserializer(serializer.getBuffer(), objStore, dummyRemoteObjectFactory)
        assertEquals(des.getByte(), SerializerTypes.Int.ordinal)
        assertEquals(des.getInt(), 101)
        assertEquals(des.getByte(), SerializerTypes.Double.ordinal)
        assertEquals(des.getDouble(), 20.5, 0.001)
    }

    @Test
    fun serializeString() {
        val objStore = ObjectStore()
        val serializer = Serializer(objStore)
        serializer.writeValue("alma a fa alatt")
        serializer.writeValue("Árvíztűrő") // check utf8 encoding
        val desLenChecker = Deserializer(serializer.getBuffer(), objStore, dummyRemoteObjectFactory)
        assertEquals(SerializerTypes.String.ordinal, desLenChecker.getByte() )
        assertEquals(15, desLenChecker.getUint16()) // len
        val des = Deserializer(serializer.getBuffer(), objStore, dummyRemoteObjectFactory)
        assertEquals("alma a fa alatt", des.readValue() )
        assertEquals("Árvíztűrő", des.readValue() )
    }

    @Test
    fun serializeDataClass() {
        data class AppleTree(val height:Int, val name:String, val numApples:Int) {
            private val dog = 10
        };
        val myTree = AppleTree(height = 10, name = "Eden", numApples = 100)
        val objStore = ObjectStore()
        val serializer = Serializer(objStore)
        serializer.writeValue(myTree)
        val des = Deserializer(serializer.getBuffer(), objStore, dummyRemoteObjectFactory)
        assertEquals(SerializerTypes.Object.ordinal, des.getByte())
        val dict = des.getDictionary()
        assertEquals(myTree.height, dict["height"])
        assertEquals(myTree.name, dict["name"])
        assertEquals(myTree.numApples, dict["numApples"])
        assertEquals(10, dict["dog"])
    }

    @Test
    fun reflectCallTest() {
        class Adder(val base:Int) {
            fun add(a:Int, b:Int) = base + a + b
        }

        val adder = Adder(10)
        val addMethod = adder::class.members.find { it.name == "add" }
        val args = arrayOf(1, 2)
        // for calling a method, it needs the receiver as first arg, also spread the remaining args
        assertEquals(13, addMethod?.call(adder, *args))
    }

    @Test
    fun loadModule() {
        // Setup
        val testTransport = TestTransport()
        val conn = MessagingConnection(testTransport, MainScope())
        val objectStore = ObjectStore() // requester will store his exported objects here
        class Logger {
            fun log(message:String) {}
        }
        val logger = Logger()
        conn.serveModule("test://test", object : Module() {
            val version = 1.0
            val logger = logger
        })
        // Expect a loadModule request
        testTransport.willSend { buf ->
            val des = Deserializer(buf, objectStore){handle  -> SimpleRemoteObject(handle)}
            val header = des.readMessageHeader()
            assertEquals(header.dir, MessageDirection.Response)
            assertEquals(header.msg, MessageType.LoadModule)
            assertEquals(header.messageId, 1)
            val module = des.readValue() as Map<String, Any?>
            assertEquals(1.0, module["version"] as Double, 0.001)
            assertEquals(SimpleRemoteObject(0u), module["logger"])
        }
        // Trigger a loadModule request
        val ser = Serializer(objectStore)
        ser.writeMessageHeader(MessageDirection.Request, MessageType.LoadModule, 1)
        ser.writeValue("loadModule")
        ser.writeValue(arrayOf("test://test"))
        testTransport.messageReceiver(ser.getBuffer())

        testTransport.verify()
    }

    @Test
    fun callMethodFromExportedObject() {
        // Setup
        val testTransport = TestTransport()
        val conn = MessagingConnection(testTransport, MainScope())
        val objectStore = ObjectStore() // requester will store his exported objects here
        class Logger {
            fun log(message:String) = "Logged: $message"
        }
        val logger = Logger()
        conn.serveModule("test://test", object : Module() {
            val version = 1.0
            val logger = logger
        })
        // Expect a loadModule request
        testTransport.willSend {   } // check skipped, see test above
        // Expect response to our log method call
        testTransport.willSend { buf ->
            val des = Deserializer(buf, objectStore){handle -> SimpleRemoteObject(handle)}
            val header = des.readMessageHeader()
            assertEquals(header.dir, MessageDirection.Response)
            assertEquals(header.msg, MessageType.Call)
            assertEquals(header.messageId, 2)

            val retval = des.readValue()
            assertEquals("Logged: Hello messaging!", retval)
        }
        // Trigger a loadModule request
        val ser = Serializer(objectStore)
        ser.writeMessageHeader(MessageDirection.Request, MessageType.LoadModule, 1)
        ser.writeValue("loadModule")
        ser.writeValue(arrayOf("test://test"))
        testTransport.messageReceiver(ser.getBuffer())

        // Trigger call of log method
        val s2 = Serializer(objectStore)
        s2.writeMessageHeader(MessageDirection.Request, MessageType.Call, 2)
        s2.writeValue(RemoteObject(0u, conn)) // object: logger was exported as object with handle 0
        s2.writeValue("log") // method
        s2.writeValue(arrayOf("Hello messaging!"))  // args
        testTransport.messageReceiver(s2.getBuffer())

        testTransport.verify()
    }

    @Test
    fun testSuspendedCall() {
        val scope = TestCoroutineScope()
        // Setup
        val testTransport = TestTransport()
        val conn = MessagingConnection(testTransport, scope)
        val objectStore = ObjectStore() // requester will store his exported objects here
        class Adder {
            suspend fun add(a:Int, b:Int, c:Int):Int {
                val ab = a+b;
                delay(500);
                return ab + c
            }
        }
        conn.serveModule("test://test", object : Module() {
            val adder = Adder()
        })
        // Expect a loadModule request
        testTransport.willSend {   } // check skipped, see loadmodule test
        // Expect response to our add method call
        testTransport.willSend { buf ->
            val des = Deserializer(buf, objectStore){handle -> SimpleRemoteObject(handle)}
            val header = des.readMessageHeader()
            assertEquals(header.dir, MessageDirection.Response)
            assertEquals(header.msg, MessageType.Call)
            assertEquals(header.messageId, 2)

            val retval = des.readValue()
            assertEquals(9, retval)
        }
        // Trigger a loadModule request
        val ser = Serializer(objectStore)
        ser.writeMessageHeader(MessageDirection.Request, MessageType.LoadModule, 1)
        ser.writeValue("loadModule")
        ser.writeValue(arrayOf("test://test"))
        testTransport.messageReceiver(ser.getBuffer())

        // Trigger call of add(2, 3, 4) method
        val s2 = Serializer(objectStore)
        s2.writeMessageHeader(MessageDirection.Request, MessageType.Call, 2)
        s2.writeValue(RemoteObject(0u, conn)) // object: adder was exported as object with handle 0
        s2.writeValue("add") // method
        s2.writeValue(arrayOf(2, 3, 4))  // args
        testTransport.messageReceiver(s2.getBuffer())

        scope.advanceUntilIdle() // completes all suspended coroutines
        testTransport.verify()
    }
}

data class SimpleRemoteObject(val handle:UInt) {}

typealias SendChecker = (buf:ByteBuffer)->Unit
class TestTransport : Transport {
    private val sendCheckers = mutableListOf<SendChecker>()
    private var numSendCalls = 0
    override fun send(buf: ByteBuffer) {
        val checker = sendCheckers.getOrNull(numSendCalls)
            ?: throw RuntimeException("Unexpected send call")
        checker(buf)
        ++numSendCalls
    }

    override var messageReceiver = fun(_:ByteBuffer){}

    fun willSend(checker:SendChecker) {
        sendCheckers.add(checker)
    }

    fun verify() {
        assertEquals("Expected at least ${sendCheckers.size} send operations! Received $numSendCalls", numSendCalls, sendCheckers.size)
    }
}