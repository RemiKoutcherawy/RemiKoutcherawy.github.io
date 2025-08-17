import {Point} from "./Point.js";
import {Vector3} from './Vector3.js';

export class Face {

    constructor(points) {
        this.points = points;
        this.offset = 0;
        this.hover = false;
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

    // Face contains 2d point
    static contains2d(face, xf, yf) {
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

        let inside = false;
        const vs = face.points;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].xf, yi = vs[i].yf;
            const xj = vs[j].xf, yj = vs[j].yf;
            // Special case where the point is part of the face.
            if (xi === xf && yi === yf) {
                return true;
            }
            const intersect = ((yi > yf) !== (yj > yf)) && (xf < (xj - xi) * (yf - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Face contains 3d point
    static contains3d(face, xCanvas, yCanvas, view3d) {
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

        const x = xCanvas, y = yCanvas;
        let inside = false;
        const pts = face.points;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const idxI = view3d.indexMap.get(pts[i]);
            const idxJ = view3d.indexMap.get(pts[j]);
            if (idxI === undefined || idxJ === undefined) continue;
            const projI = view3d.projected[idxI];
            const projJ = view3d.projected[idxJ];
            if (!projI || !projJ) continue;
            const xi = projI[0], yi = projI[1];
            const xj = projJ[0], yj = projJ[1];
            // Special case where the point is part of the face.
            if (xi === xCanvas && yi === yCanvas) {
                return true;
            }

            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
// 102 lines of code
