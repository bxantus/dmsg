// source and explanation from: http://www.movable-type.co.uk/scripts/latlong.html
// also it has a github repo: https://github.com/chrisveness/geodesy

import { Location } from './locationService.ts'

// This uses the ‘haversine’ formula to calculate the great-circle distance between two points 
// – that is, the shortest distance over the earth’s surface – giving an ‘as-the-crow-flies’ distance between the points
export function distance(lat1:number, lon1:number, lat2:number, lon2:number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

export function distanceBetween(loc1:Location, loc2:Location) {
    return distance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
}