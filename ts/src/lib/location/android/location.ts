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
}