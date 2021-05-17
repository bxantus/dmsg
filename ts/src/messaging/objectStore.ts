/**
 * Utility class for storing two-way objects to id mapping.
 * It can be used to maintain exported object handles for messaging.
 * It relies on the fact that the store is only additive (handles can't be removed), to generate
 * unique handles.
 */
export default class ObjectStore {
    private objects = new Map<object, number>()
    private objectsByHandle = new Map<number, object>()

    getHandle(obj:object) {
        let handle = this.objects.get(obj)
        if (!handle) {
            handle = this.objects.size
            this.objects.set(obj, handle)
            this.objectsByHandle.set(handle, obj)
        }
        return handle
    }

    getObject(handle:number) {
        return this.objectsByHandle.get(handle)
    }
}