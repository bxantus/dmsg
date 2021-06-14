// todo: use this interface in places.ts too
export interface Location {
    longitude:number
    latitude:number
    // when any of the below fields equal 0, means that they aren't available
    altitude?:number
    bearing?:number
    accuracy?:number
    speed?:number
}

// todo: this interface is deprecated, rewrite usages to use ILocationProvider (see below)
export interface LocationService {
    currentPosition?:Location // this can be the last know position too
    heading?:number  // if available it corresponds to user heading: 0 north, 90 east etc.
    live:boolean     // when false currentPosition is the last known position
    // todo: add other methods based on android an iOS (maybe web location) interfaces
}

export interface LocationUpdateRequest {
    // the minimum interval to receive location updates
    interval:number
}

export type LocationUpdateListener = (loc:Location)=>void

export interface ILocationProvider {
    getLastLocation():Promise<Location>
    /// checks whether settings are enabled for this kind of location request
    /// if not it will try to show system popup which will enable location
    // NOTE: should check if iOS has something similar
    checkSettings(forRequest:LocationUpdateRequest):Promise<boolean>
    /// starts location updates for the request, returns a handle for the request
    requestUpdates(req:LocationUpdateRequest, listener:LocationUpdateListener):Promise<any>
    /// stop location updates for the given handle
    stopUpdates(handle:any):Promise<void>
}