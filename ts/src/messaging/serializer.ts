// serialize messages in Uint8Array format
// overview:
//   - basic types like number, string, etc. will be serialized as tagged values (type, val)
//   - objects may be of 3 types
//     - simple object literals (no class instance etc.): will be serialized unpacked, with all fields recursively serialized
//     - arrays will probably serialize fully as well, but maybe this isn't inteded we could use Tuple's for this (const array)
//     - objects received from the other peer (remote objects) will be serailized by object handle
//     - all other objects will be serialized as object handles (objects mapped to a unique id at our side)

enum SerializerTypes {
    Undef,
    Int,
    Double,
    String,
    ObjectHandle,
    RemoteObjectHandle,
    Array,
    Object, // an object consisting of key/value pairs
}

export class Serializer {
    // todo: collect messages in list of Utf8Arrays (chunks), it is up to transport to send them efficiently

    writeMessageHeader() {

    }

    writeValue(val:any) {

    }

    // the functions below just serialize the objects without any typetags
    // use writeValue to output objects with typetags

    writeString(s:string) {

    }
}

export class Deserializer {

}