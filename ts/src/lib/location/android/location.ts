import { RemoteObj } from '../../../messaging/messagingConnection.ts'
import { Location, ILocationProvider, LocationUpdateListener, LocationUpdateRequest } from "../locationService.ts"

export interface LocationModule {
    readonly locationProvider:AndroidLocationProvider
}

export interface AndroidLocationProvider {
    getLastLocation():Promise<Location>
    createLocationRequest(interval:number):Promise<RemoteObj>
    /// checks whether settings are enabled for this kind of location request
    /// if not it will try to show system popup which will enable location
    checkSettings(forRequest:RemoteObj):Promise<boolean>
    /// starts location updates for the request created with createLocationRequest
    /// returns the android locationCb which can be used to stop requests
    requestUpdates(req:RemoteObj, listener:LocationUpdateListener):Promise<RemoteObj>
    stopUpdates(handle:RemoteObj):Promise<void>
}

export class LocationProvider implements ILocationProvider {
    private androidProvider:AndroidLocationProvider
    private lastRequest:{ obj:RemoteObj, interval:number }|undefined 
    
    constructor(mod:LocationModule) {
        this.androidProvider = mod.locationProvider
    }
    
    getLastLocation() {
        return this.androidProvider.getLastLocation()
    }
    
    async checkSettings(forRequest:LocationUpdateRequest) {
        return this.androidProvider.checkSettings(await this.getAndroidRequest(forRequest))
    }

    
    async requestUpdates(req:LocationUpdateRequest, listener:LocationUpdateListener) {
        return this.androidProvider.requestUpdates(await this.getAndroidRequest(req), listener)
    }

    stopUpdates(handle:any) {
        return this.androidProvider.stopUpdates(handle)
    }

    private async getAndroidRequest(forRequest:LocationUpdateRequest) {
        let request:RemoteObj
        if (this.lastRequest?.interval == forRequest.interval) 
            request = this.lastRequest.obj
        else {
            request = await this.androidProvider.createLocationRequest(forRequest.interval)
            this.lastRequest = { obj: request, interval:forRequest.interval }
        }
        return request
    }
}