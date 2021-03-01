// todo: currently duplicated here and in places.ts
// probably should bring places closer
export interface Location {
    lat:number
    lon:number
}

export interface LocationService {
    currentPosition?:Location // this can be the last know position too
    heading?:number  // if available it corresponds to user heading: 0 north, 90 east etc.
    live:boolean     // when false currentPosition is the last known position
    // todo: add other methods based on android an iOS (maybe web location) interfaces
}