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

/*
 * Ellipsoid parameters; exposed through static getter below.
 *
 * The only ellipsoid defined is WGS84, for use in utm/mgrs, vincenty, nvector.
 */
const ellipsoids = {
    WGS84: { a: 6378137, b: 6356752.314245, f: 1/298.257223563 },
};
const π = Math.PI;
const ε = Number.EPSILON;

// taken from: https://www.movable-type.co.uk/scripts/latlong-vincenty.html
export function distanceVincenty(lat1:number, lon1:number, lat2:number, lon2:number) {
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const λ1 = lon1 * Math.PI/180;
    const λ2 = lon2 * Math.PI/180;

    // allow alternative ellipsoid to be specified
    const { a, b, f } = ellipsoids.WGS84;

    const L = λ2 - λ1; // L = difference in longitude, U = reduced latitude, defined by tan U = (1-f)·tanφ.
    const tanU1 = (1-f) * Math.tan(φ1), cosU1 = 1 / Math.sqrt((1 + tanU1*tanU1)), sinU1 = tanU1 * cosU1;
    const tanU2 = (1-f) * Math.tan(φ2), cosU2 = 1 / Math.sqrt((1 + tanU2*tanU2)), sinU2 = tanU2 * cosU2;

    const antipodal = Math.abs(L) > π/2 || Math.abs(φ2-φ1) > π/2;

    let λ = L, sinλ = 0, cosλ = 0; // λ = difference in longitude on an auxiliary sphere
    let σ = antipodal ? π : 0, sinσ = 0, cosσ = antipodal ? -1 : 1, sinSqσ = 0; // σ = angular distance P₁ P₂ on the sphere
    let cos2σₘ = 1;                      // σₘ = angular distance on the sphere from the equator to the midpoint of the line
    let cosSqα = 1;                      // α = azimuth of the geodesic at the equator

    let λʹ = 0, iterations = 0;
    do {
        sinλ = Math.sin(λ);
        cosλ = Math.cos(λ);
        sinSqσ = (cosU2*sinλ)**2 + (cosU1*sinU2-sinU1*cosU2*cosλ)**2;
        if (Math.abs(sinSqσ) < 1e-24) break;  // co-incident/antipodal points (falls back on λ/σ = L)
        sinσ = Math.sqrt(sinSqσ);
        cosσ = sinU1*sinU2 + cosU1*cosU2*cosλ;
        σ = Math.atan2(sinσ, cosσ);
        const sinα = cosU1 * cosU2 * sinλ / sinσ;
        cosSqα = 1 - sinα*sinα;
        cos2σₘ = (cosSqα != 0) ? (cosσ - 2*sinU1*sinU2/cosSqα) : 0; // on equatorial line cos²α = 0 (§6)
        const C = f/16*cosSqα*(4+f*(4-3*cosSqα));
        λʹ = λ;
        λ = L + (1-C) * f * sinα * (σ + C*sinσ*(cos2σₘ+C*cosσ*(-1+2*cos2σₘ*cos2σₘ)));
        const iterationCheck = antipodal ? Math.abs(λ)-π : Math.abs(λ);
        if (iterationCheck > π) throw new EvalError('λ > π');
    } while (Math.abs(λ-λʹ) > 1e-12 && ++iterations<1000);
    if (iterations >= 1000) throw new EvalError('Vincenty formula failed to converge');

    const uSq = cosSqα * (a*a - b*b) / (b*b);
    const A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
    const B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
    const Δσ = B*sinσ*(cos2σₘ+B/4*(cosσ*(-1+2*cos2σₘ*cos2σₘ)-B/6*cos2σₘ*(-3+4*sinσ*sinσ)*(-3+4*cos2σₘ*cos2σₘ)));

    const s = b*A*(σ-Δσ); // s = length of the geodesic

    return s
}

export function distanceBetween(loc1:Location, loc2:Location) {
    return distance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
}

/// forward azimuth from point 1 towards point 2
export function bearing(lat1:number, lon1:number, lat2:number, lon2:number) {
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const brng = (θ*180/Math.PI + 360) % 360; // in degrees
    return brng
}