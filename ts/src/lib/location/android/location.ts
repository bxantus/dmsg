import { RemoteObj } from '../../../messaging/messagingConnection.ts'
import { Location } from "../locationService.ts"

export interface LocationModule {
    readonly locationProvider:LocationProvider
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