import { MessagingSymbol, MessageDirection, MessageType } from './messagingConnection.ts'
import ObjectStore from './objectStore.ts'
// serialize messages in Uint8Array format
// overview:
//   - basic types like number, string, etc. will be serialized as tagged values (type, val)
//   - objects may be of 3 types
//     - simple object literals (no class instance etc.): will be serialized unpacked, with all fields recursively serialized
//     - arrays will probably serialize fully as well, but maybe this isn't inteded we could use Tuple's for this (const array)
//     - objects received from the other peer (remote objects) will be serailized by object handle
//     - all other objects will be serialized as object handles (objects mapped to a unique id at our side)

export enum SerializerTypes {
    Undef,
    Bool,
    Int,
    Double,
    String,

    ObjectHandle,
    RemoteObjectHandle,
    Array,
    Object, // an object consisting of key/value pairs

    Backref, // back reference to an object/array already written in this stream (by idx.)
}

const CHUNK_SIZE = 1024

export class Serializer {
    // will collect messages in list of Utf8Arrays (chunks), it is up to transport to send them efficiently
    private chunks:Uint8Array[] = []
    private buf = new Uint8Array(CHUNK_SIZE)
    private dv:DataView = new DataView(this.buf.buffer)
    private offs = 0
    private serializedObjects = new Map<object, number>()

    constructor(private exportedObjects:ObjectStore) {

    }

    getData() {
        if (this.offs > 0)
            this.closeChunk()
        return this.chunks
    }

    writeMessageHeader(dir:MessageDirection, msg:MessageType, messageId:number) {
        this.putByte((dir << 4) | msg)
        this.putUint(messageId)
    }

    writeValue(val:any) {
        if (val === undefined || val == null) {
            this.putByte(SerializerTypes.Undef)
            return;
        }
        const type = typeof val
        switch (type) {
            case "boolean": {
                this.putByte(SerializerTypes.Bool)
                this.putByte(val ? 1 : 0)
            } break;
            case "number": {
                if (Number.isInteger(val)) {
                    this.putByte(SerializerTypes.Int)
                    this.putInt(val)
                } else {
                    this.putByte(SerializerTypes.Double)
                    this.putDouble(val)
                }
            } break;
            case "string": {
                this.putByte(SerializerTypes.String)
                this.putString(val)
            } break;
            case "object": {
                // detect remote object handles
                if (val[MessagingSymbol.RemoteObject]) {
                    this.putByte(SerializerTypes.RemoteObjectHandle)
                    this.putUint(val[MessagingSymbol.RemoteObjectId])
                } else if (val instanceof Array) 
                    this.writeArray(val)
                else if (val.constructor.name != "Object") {
                    // some kind of an object, different from a plain obj. literal
                    this.putByte(SerializerTypes.ObjectHandle)
                    this.putUint(this.exportedObjects.getHandle(val))
                } else 
                    this.writeRecord(val)
            } break;
            case "function": { // functions always exported as handle
                this.putByte(SerializerTypes.ObjectHandle)
                this.putUint(this.exportedObjects.getHandle(val))
            } break;
        }
    }

    writeArray(arr:any[]) {
        if (this.registerOrWriteBackref(arr)) return
        this.putByte(SerializerTypes.Array)
        if (arr.length >= (1 << 16))
            throw new Error("Array size too big")
        this.putUint16(arr.length)
        for (const val of arr)
            this.writeValue(val)
    }

    writeRecord(obj:any) {
        if (this.registerOrWriteBackref(obj)) return
        this.putByte(SerializerTypes.Object)
        const dvForSize = this.alloc(2)
        const offsForSize = this.offs
        this.offs += 2 // leave space for size
        let size = 0
        for (const key in obj) {
            this.putString(key)
            this.writeValue(obj[key])
            ++size
        }
        dvForSize.setUint16(offsForSize, size)
    }

    /**  
     * @return true, when backref is written 
     */
    private registerOrWriteBackref(obj:object) {
        let backrefId = this.serializedObjects.get(obj)
        if (backrefId === undefined) {
            this.serializedObjects.set(obj, this.serializedObjects.size)
            return false
        } else {
            this.putByte(SerializerTypes.Backref)
            this.putUint(backrefId)
            return true
        }
    }

    // the functions below just serialize the objects without any typetags
    // use writeValue to output objects with typetags

    putString(s:string) {
        const utf8Stream = new TextEncoder().encode(s)
        if (utf8Stream.byteLength >= (1 << 16))
            throw new Error("string too long to serialize, with current limitations 16 bit size")
        this.putUint16(utf8Stream.byteLength)
        this.putBuffer(utf8Stream)
    }

    putByte(val:number) {
        const dv = this.alloc(1)
        dv.setUint8(this.incOffset(1), val)
    }

    putInt(val:number) {
        const dv = this.alloc(4)
        dv.setInt32(this.incOffset(4), val)
    }

    putUint(val:number) {
        const dv = this.alloc(4)
        dv.setUint32(this.incOffset(4), val)
    }

    putDouble(val:number) {
        const dv = this.alloc(8)
        dv.setFloat64(this.incOffset(8), val)
    }

    putUint16(val:number) {
        const dv = this.alloc(2)
        dv.setUint16(this.incOffset(2), val)
    }

    putBuffer(srcBuf:Uint8Array) {
        let available = CHUNK_SIZE - this.offs
        if (available == 0) available = CHUNK_SIZE
        let size = Math.min(srcBuf.byteLength, available)
        let srcOffs = 0
        while (srcOffs < srcBuf.byteLength) {
            this.alloc(size)
            this.buf.set(srcBuf.subarray(srcOffs, size), this.incOffset(size)) 
            srcOffs += size
            // we're at either the end of srcBuf, or finished a chunk
            size = Math.min(srcBuf.byteLength - srcOffs, CHUNK_SIZE)
        }
    }

    private alloc(size:number) { // alloc needed size in buffer, create new chunk if needed
        if (this.offs + size > CHUNK_SIZE)  
            this.closeChunk()
        return this.dv
    }

    private closeChunk() {
        this.chunks.push(this.offs == CHUNK_SIZE ? this.buf : this.buf.subarray(0, this.offs))
        this.buf = new Uint8Array(CHUNK_SIZE)
        this.offs = 0
        this.dv = new DataView(this.buf.buffer)
    }

    private incOffset(size:number) {
        const old = this.offs
        this.offs += size;
        return old
    }
}

export type RemoteObjectFactory = (id:number) => any

export class Deserializer {
    private offs = 0
    private dv:DataView
    private objects:object[] = [] // objects read so far (to handle back references)
    constructor(private buf:Uint8Array, private exportedObjects:ObjectStore, private remoteObjectFactory:RemoteObjectFactory) {
        this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    }

    readMessageHeader() {
        const dirAndType = this.getByte()
        const id = this.getUint()
        return {
            dir: (dirAndType >> 4) as MessageDirection,
            type: (dirAndType & 0xF) as MessageType,
            id
        }
    }

    readValue():any {
        const type:SerializerTypes = this.getByte()
        switch (type) {
            case SerializerTypes.Undef: return undefined;
            case SerializerTypes.Bool: return this.getByte() ? true : false;
            case SerializerTypes.Int: return this.getInt();
            case SerializerTypes.Double: return this.getDouble();
            case SerializerTypes.String: return this.getString();
            case SerializerTypes.ObjectHandle: 
                // remote object from our point of view
                return this.remoteObjectFactory(this.getUint())
            
            case SerializerTypes.RemoteObjectHandle: 
                // this should be our own object
                return this.exportedObjects.getObject(this.getUint())
            
            case SerializerTypes.Array: return this.readArray();
            case SerializerTypes.Object: return this.readRecord();
            // back reference to an object/array already read from this stream (by idx.)
            case SerializerTypes.Backref: return this.objects[this.getUint()]; 
        }
    }

    readArray():any[] {
        const arr:any[] = []
        this.objects.push(arr)
        const len = this.getUint16()
        for (let idx = 0; idx < len; ++idx) {
            arr.push(this.readValue())
        }
        return arr
    }

    readRecord():any {
        const obj:any = {}
        this.objects.push(obj)
        const len = this.getUint16()
        for (let idx = 0; idx < len; ++idx) {
            const prop = this.getString()
            const val = this.readValue()
            obj[prop] = val
        }
        return obj
    }

    getString() {
        const len = this.getUint16()
        const s = new TextDecoder().decode(this.buf.subarray(this.offs, this.offs + len))
        this.offs += len
        return s
    }

    getByte() {
        return this.buf[this.offs++]
    }

    getInt() {
        return this.dv.getInt32(this.incOffset(4))
    }

    getUint() {
        return this.dv.getUint32(this.incOffset(4))
    }

    getUint16() {
        return this.dv.getUint16(this.incOffset(2))
    }

    getDouble() {
        return this.dv.getFloat64(this.incOffset(8))
    }

    private incOffset(size:number) {
        const old = this.offs
        this.offs += size;
        return old
    }
}