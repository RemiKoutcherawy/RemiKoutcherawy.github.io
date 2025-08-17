import {Vector3} from './Vector3.js';
import {Point} from './Point.js';

export class Segment {

    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
        this.hover = false;
        this.select = 0;
    }

    // 2d distance from Segment to Point
    static distance2d(x1, y1, x2, y2, x, y) {
        // https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
        // Handle case where the segment degenerates in a single point.
        const l2 = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
        if (l2 === 0) {
            return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        }
        // Consider the line extending the segment, parameterized as v + t (w - v).
        // Find the projection of point p onto the line.
        // It falls where t = [(p-v) . (w-v)] / |w-v|^2
        const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
        if (t < 0) {
            return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        }
        if (t > 1) {
            return Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));
        }
        const projectionX = x1 + t * (x2 - x1);
        const projectionY = y1 + t * (y2 - y1);
        return Math.sqrt((x - projectionX) * (x - projectionX) + (y - projectionY) * (y - projectionY));
    }

    // Area counter clock wise, CCW, gives 2d signed distance between Point and Segment in 3d
    static CCW(a, b, c) {
        return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
    }

    // Area CounterClockWise, CCW, gives 2d signed distance between Point and Segment in 2d Crease pattern
    static CCWFlat(a, b, c) {
        return (a.xf - c.xf) * (b.yf - c.yf) - (a.yf - c.yf) * (b.xf - c.xf);
    }

    // 2d intersection between two segments ab and cd
    static intersectionFlat(a, b, c, d) {

        // Collinear case, maybe too much
        function collinear(a, b, c, d) {
            // length
            const ab = (b.xf - a.xf) * (b.xf - a.xf) + (b.yf - a.yf) * (b.yf - a.yf);
            const cd = (d.xf - c.xf) * (d.xf - c.xf) + (d.yf - c.yf) * (d.yf - c.yf);
            // degenerated cases
            if (ab === 0) {
                if (cd === 0) {
                    return a.xf === c.xf ? a : undefined;
                }
                // project 'a' on 'cd'
                const t = a.xf * (c.xf - d.xf) + a.yf * (c.yf - d.yf);
                if (t < 0 || t > 1) {
                    return undefined;
                }
                return a;
            }
            // project a,b,c,d on segment ab which is not degenerated
            const tc = ((b.xf - a.xf) * c.xf + (b.yf - a.yf) * c.yf) / ab;
            const td = ((b.xf - a.xf) * d.xf + (b.yf - a.yf) * d.yf) / ab;
            if (tc < 0) { // c on the left of ab
                if (td < 0) { // d on the left of ab
                    return undefined;
                } else if (td > 1) { // d on the right of ab
                    return a; // could be a or b
                }
                return d; // d between a and b could return a or d
            } else if (tc > 1) { // c on the right of ab
                if (td > 1) {  // d on the right of ab
                    return undefined;
                }
                return d; // d between a and b could return b or d
            }
            return c; // could be c or b
        }

        // Area from ab to d and from ab to c
        const a1 = Segment.CCWFlat(a, b, d);
        const a2 = Segment.CCWFlat(a, b, c);

        // Intersection
        if (a1 * a2 <= 0.0) {
            const a3 = Segment.CCWFlat(c, d, a);
            const a4 = a3 + a2 - a1;
            if (a3 * a4 <= 0.0) {
                if (a3 - a4 === 0) {
                    return collinear(a, b, c, d);
                } else {
                    const t = a3 / (a3 - a4);
                    return new Point(a.xf + t * (b.xf - a.xf), a.yf + t * (b.yf - a.yf));
                }
            }
        }
        return undefined;
    }

    // Basic intersection used for tests, does not handle collinear, or superposed
    static intersection2dBasicFlat(a, b, c, d) {
        const v1_x = b.xf - a.xf;
        const v1_y = b.yf - a.yf;
        const v2_x = d.xf - c.xf;
        const v2_y = d.yf - c.yf;
        const s = (-v1_y * (a.xf - c.xf) + v1_x * (a.yf - c.yf)) / (-v2_x * v1_y + v1_x * v2_y);
        const t = (v2_x * (a.yf - c.yf) - v2_y * (a.xf - c.xf)) / (-v2_x * v1_y + v1_x * v2_y);
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            const xf = a.xf + (t * v1_x);
            const yf = a.yf + (t * v1_y);
            return new Point(xf, yf);
        }
        return undefined ;
    }

    // Lines in 2D
    static intersection2dLines(a, b, c, d) {
        const v1_x = b.xf - a.xf;
        const v1_y = b.yf - a.yf;
        const v2_x = d.xf - c.xf;
        const v2_y = d.yf - c.yf;
        const determinant = -v2_x * v1_y + v1_x * v2_y;
        if (Math.round(determinant) < 1e-3) {
            return undefined;
        }
        // let s = (-v1_y * (a.xf - c.xf) + v1_x * (a.yf - c.yf)) / determinant;
        const t = (v2_x * (a.yf - c.yf) - v2_y * (a.xf - c.xf)) / determinant;
        const xf = a.xf + (t * v1_x);
        const yf = a.yf + (t * v1_y);
        return new Point(xf, yf);
    }

    // 3d distance from segment to segment
    static distanceToSegment(A, B, C, D) {
        const {p, q} = Segment.closestSegment(A, B, C, D);
        const pq = new Vector3(q.x - p.x, q.y - p.y, q.z - p.z);
        return Vector3.length3d(pq);
    }

    // Closest points between line [A, B] and line [C, D] return {p, q}
    static closestSegment(A, B, C, D) {

        // On AB segment we have : P(s)=A+s*(B-C)
        // On CD segment we have : Q(t)=C.p1+t*(D-C)
        // Vector PQ perpendicular to both lines : PQ(s,t).AB=0  PQ(s,t).CD=0
        // Cramer system :
        // (AB.AB)*s - (AB.CD)*t = -AB.r <=> a*s -b*t = -c
        // (AB.CD)*s - (CD.CD)*t = -CD.r <=> b*s -e*t = -f
        // Solved to s=(bf-ce)/(ae-bb) t=(af-bc)/(ae-bb)
        let s, t, closest;
        const EPSILON = 1e-6;
        const AB = new Vector3(B.x - A.x, B.y - A.y, B.z - A.z);
        const CD = new Vector3(D.x - C.x, D.y - C.y, D.z - C.z);
        const CA = new Vector3(A.x - C.x, A.y - C.y, A.z - C.z); // C to A
        const a = Vector3.dot(AB, AB); // squared length of AB
        const e = Vector3.dot(CD, CD); // squared length of CD
        const f = Vector3.dot(CD, CA);
        // Check for degeneration of segments into points
        if (a < EPSILON && e < EPSILON) {
            // Both degenerate into points
            // s = t = 0.0;
            closest = {p: A, q: C};
        } else {
            if (a < EPSILON) {
                // AB segment degenerate into point
                s = 0.0;
                t = f / e; // s=0 => t=(b*s+f)/e = f/e
                t = t < 0 ? 0 : t > 1 ? 1 : t;
            } else {
                const c = Vector3.dot(AB, CA);
                if (e < EPSILON) {
                    // CD segment degenerate into point
                    t = 0.0;
                    s = -c / a; // t=0 => s=(b*t-c)/a = -c/a
                    s = s < 0 ? 0 : s > 1 ? 1 : s;
                } else {
                    // General case
                    const b = Vector3.dot(AB, CD); // Delayed computation of b
                    const denominator = a * e - b * b; // Denominator of cramer system
                    // Segments not parallel, compute closest
                    if (denominator !== 0.0) {
                        s = (b * f - c * e) / denominator
                        s = s < 0 ? 0 : s > 1 ? 1 : s;
                    } else {
                        // Arbitrary point, here 0 => p1
                        s = 0;
                    }
                    // Compute the closest on CD using s
                    t = (b * s + f) / e;
                    // if t in [0,1] done, else clamp t and recompute s
                    if (t < 0.0) {
                        t = 0;
                        s = -c / a;
                        s = s < 0 ? 0 : s > 1 ? 1 : s;
                    } else if (t > 1.0) {
                        t = 1.0;
                        s = (b - c) / a;
                        s = s < 0 ? 0 : s > 1 ? 1 : s;
                    }
                }
            }
            const P = Vector3.add(new Vector3(A.x, A.y, A.z), (Vector3.scale(AB, s))); // P = a+s*(b-a)
            const Q = Vector3.add(new Vector3(C.x, C.y, C.z), (Vector3.scale(CD, t))); // Q = c+t*(d-c)
            closest = {p: P, q: Q};
        }
        return closest;
    }

    // 3d length3d (x, y, z)
    static length3d(s) {
        return Math.sqrt((s.p1.x - s.p2.x) * (s.p1.x - s.p2.x)
            + (s.p1.y - s.p2.y) * (s.p1.y - s.p2.y)
            + (s.p1.z - s.p2.z) * (s.p1.z - s.p2.z));
    }

    // 2d length3d (xf, yf)
    static length2d(s) {
        return Math.sqrt((s.p1.xf - s.p2.xf) * (s.p1.xf - s.p2.xf)
            + (s.p1.yf - s.p2.yf) * (s.p1.yf - s.p2.yf));
    }

    static project2d(s, p) {
        // Line extending segment, parameterized as v + t (p2 - p1).
        // It falls where t = [(p-p1) . (p2-p1)] / |p2-p1|^2
        const l2 = (s.p2.xf - s.p1.xf) * (s.p2.xf - s.p1.xf) + (s.p2.yf - s.p1.yf) * (s.p2.yf - s.p1.yf);
        const t = ((p.xf - s.p1.xf) * (s.p2.xf - s.p1.xf) + (p.yf - s.p1.yf) * (s.p2.yf - s.p1.yf)) / l2;
        if (t < 0 || t > 1) {
            return undefined;
        }
        const pXf = s.p1.xf + t * (s.p2.xf - s.p1.xf);
        const pYf = s.p1.yf + t * (s.p2.yf - s.p1.yf);
        return new Point(pXf, pYf);
    }
}
// 228
