import { RemoteObj } from '../../../messaging/messagingConnection.ts'

export interface LocationModule {
    readonly locationProvider:LocationProvider
}

export interface Location {
    longitude:number
    latitude:number
    // when any of the below fields equal 0, means that they aren't available
    altitude:number
    bearing:number
    accuracy:number
    speed:number
}

export interface LocationProvider {
    getLastLocation():Promise<Location>
    createLocationRequest(interval:number):Promise<RemoteObj>
    /// checks whether settings are enabled for this kind of location request
    /// if not it will try to show system popup which will enable location
    checkSettings(forRequest:RemoteObj):boolean
    /// starts location updates for the request created with createLocationRequest
    requestUpdates(req:RemoteObj, listener:(loc:Location)=>void):Promise<void>
}