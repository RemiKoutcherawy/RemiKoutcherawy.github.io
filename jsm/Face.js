import {Point} from "./Point.js";
import {Vector3} from './Vector3.js';

export class Face {

    constructor(points) {
        this.points = points;
        this.offset = 0;

        this.select = 0;
    }

    // Area 2d for an array of points
    static area2dFlat(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            area += points[i].xf * points[(i + 1) % points.length].yf - points[i].yf * points[(i + 1) % points.length].xf;
        }
        return area / 2;
    }

    // Distance 2d from line AB to point C
    static distance2dLineToPoint(a, b, c) {
        // Cross-product AC x AB give z > 0 if C is on the right, ACB is CCW
        // AC = C-A and AB = B-A
        return (c.xf - a.xf) * (b.yf - a.yf) - (c.yf - a.yf) * (b.xf - a.xf);
    }

    // Intersection with a segment (a,b)
    static intersectionPlaneSegment(plane, a, b) {
        // (A+tAB).N = d <=> t = (d-A.N) / (AB.N) then Q=A+tAB 0<t<1
        const ab = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
        const abn = Vector3.dot(plane.normal, ab);
        // segment parallel to the plane
        if (abn === 0) return undefined;
        // segment crossing
        const t = (Vector3.dot(plane.normal, plane.origin) - Vector3.dot(plane.normal, a)) / abn;
        if (t >= 0 && t <= 1.0) {
            Vector3.scale(ab, t);
            return new Point(NaN, NaN, a.x + ab.x, a.y + ab.y, a.z + ab.z);
        }
        return undefined;
    }

    // Area 3d x,y,z
    static area3d(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            area += points[i].x * points[(i + 1) % points.length].y - points[i].y * points[(i + 1) % points.length].x;
        }
        return area / 2;
    }

    // Signed distance in 3d
    static planeToPointSignedDistance(plane, point) {
        // Signed distance from plane(origin, normal) to point
        // (A+tAB).N = d <=> d<e front, d>e behind, else on plane
        return Vector3.dot(plane.normal, point) - Vector3.dot(plane.normal, plane.origin);
    }
}
    
// 102 lines of code
