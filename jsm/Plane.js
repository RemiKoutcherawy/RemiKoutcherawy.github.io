import {Vector3} from "./Vector3.js";

export class Plane {

    // Plane is defined by an origin point R, and a normal vector N
    // point P is on the plane if and only if RP.N = 0
    constructor(origin, normal) {
        this.origin = origin;
        this.normal = Vector3.normalize(normal);
    }

    // Plane across 2 points
    static across = function (p1, p2) {
        const normal = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const middle = new Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
        return new Plane(middle, normal);
    };

    // Plane by 2 points on xy orthogonal to z
    static by = function (p1, p2) {
        // Turn 90° on the right (x,y) to (y,-x)
        const normal = new Vector3((p2.y - p1.y), -(p2.x - p1.x), 0);
        return new Plane(p1, normal);
    };

    // Plane orthogonal to a segment [p1, p2] passing by point
    static orthogonal = function (p1, p2, point) {
        const normal = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        return new Plane(point, normal);
    }

}
// 32
