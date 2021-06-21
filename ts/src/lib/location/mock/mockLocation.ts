import { Location, ILocationProvider, LocationUpdateListener, LocationUpdateRequest, locationFrom } from "../locationService.ts"
import { make } from "../../base.ts"
import { distanceBetween } from "../distance.ts"

type ShortLocation = [number, number] // lat/lon
export const PathAroundHeroesSquare:ShortLocation[] = [[47.51536, 19.07759], // near the statues
                                                       [47.51544, 19.07797],
                                                       [47.51550, 19.07822],
                                                       [47.51534, 19.07849],
                                                       [47.51600, 19.07998],  // over the bridge (Zelinski)
                                                       [47.51558, 19.08063],
                                                       [47.51597, 19.08157],
                                                       [47.51532, 19.08275],
                                                       [47.51522, 19.08317], // anonyus statue
                                                 ]

interface Request {
    req:LocationUpdateRequest
    listener:LocationUpdateListener
}

/// Will provide location updates on the path of lat/lon points
/// if it reaches the end point it will turn around
/// speed can be set in km/h-s
export class MockLocationProvider implements ILocationProvider {
    path:Location[] = []
    speedKph:number
    private _accuracy = 10 // todo: change to private fields onece firefox has them (from version 90)
    private currentSegment:PathSegment
    private pathIdx:number 
    private direction:1|-1 = 1 // direction to traverse the path segment
    private requests:Request[] = []
    private timer:number = 0

    set accuracy(a:number) {
        this._accuracy = a
        this.currentSegment.accuracy = a
    }

    get accuracy() { return this._accuracy }
    
    constructor(startPath:ShortLocation[] = PathAroundHeroesSquare, speedKph = 4) {
        this.path = startPath.map(loc => make({latitude: loc[0], longitude: loc[1]}))
        this.pathIdx = 0
        this.currentSegment = new PathSegment(this.path[0], this.path[1], this._accuracy)
        this.speedKph = speedKph
    }
    async getLastLocation() {
        return this.currentSegment.current
    }
    /// checks whether settings are enabled for this kind of location request
    /// if not it will try to show system popup which will enable location
    // NOTE: should check if iOS has something similar
    async checkSettings(forRequest:LocationUpdateRequest):Promise<boolean> {
        return true // NOTE: maybe later we could show popups here (via the mockSystemDialogs interface)
    }

    /// starts location updates for the request, returns a handle for the request
    async requestUpdates(req:LocationUpdateRequest, listener:LocationUpdateListener) {
        const request:Request = { req, listener}
        if (this.requests.length == 0) {
            // start timer. will update once per second no matter what the request interval is
            this.timer = setInterval(()=> this.updatePosition(1000), 1000)
        }
        this.requests.push(request)
        return request
    }
    /// stop location updates for the given handle
    async stopUpdates(handle:any) {
        const req = handle as Request
        const idx = this.requests.indexOf(req)
        if (idx >= 0) {
            this.requests.splice(idx, 1)
            if (this.requests.length == 0)
                clearInterval(this.timer)
        }
    }

    private updatePosition(dt:number) {
        // calc distance in meters: speed is in km/h, dt in milliseconds
        // dt * speed / millicsecondsInHour = distance in kilometers
        // => dInKm * 1000 is the same as we only divide by seconds in hour 
        const distance = dt * this.speedKph / 3600
        let overflow = this.currentSegment.advance(distance)
        while (overflow > 0) { // choose next segment
            this.nextSegment()
            overflow = this.currentSegment.advance(overflow)
        }
        // send updates to the requestors
        for (const req of this.requests) 
            req.listener(this.currentSegment.current)
    }

    private nextSegment() {
        if (this.direction == 1) {
            ++this.pathIdx
            if (this.pathIdx + 1 >= this.path.length) // reached the end 
                this.direction = -1
        } else {
            --this.pathIdx
            if (this.pathIdx == 0) // reached the start
                this.direction = 1
        }
        this.currentSegment = new PathSegment(this.path[this.pathIdx],
                                              this.path[this.pathIdx + this.direction], this._accuracy)
    }
}

class PathSegment {
    current:Location

    progress:number = 0
    distance:number
    constructor(public start:Location, public end:Location, public accuracy:number) {
        this.distance = distanceBetween(start, end)
        this.current = locationFrom(this.start)
        this.current.accuracy = this.accuracy
    }

    // return the distance overflow (should be taken on the next segment)
    advance(distanceInMeters:number):number {
        this.progress += distanceInMeters
        if (this.progress > this.distance) {
            this.current = this.end
            const prog = this.progress
            this.progress = this.distance
            return prog - this.distance
        } else {
            const s = this.start
            const e = this.end
            this.current.latitude = s.latitude + (e.latitude - s.latitude) * this.progress / this.distance 
            this.current.longitude = s.longitude + (e.longitude - s.longitude) * this.progress / this.distance 
            this.current.accuracy = this.accuracy
            // todo: if we can should calculate bearing too
        }
        return 0
    }
}