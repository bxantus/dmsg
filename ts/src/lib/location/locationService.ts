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

export interface LocationService {
    currentPosition?:Location // this can be the last know position too
    heading?:number  // if available it corresponds to user heading: 0 north, 90 east etc.
    live:boolean     // when false currentPosition is the last known position
    // todo: add other methods based on android an iOS (maybe web location) interfaces
}