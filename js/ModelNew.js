class Model {

    constructor() {
        this.points = [];
        this.segments = [];
        this.faces = [];

        // Hover and Select
        this._hoveredPoints = [];
        this._hoveredSegments = [];
        this._selectedPoints = [];
        this._selectedSegments = [];

    }

    // Initialize with a list of 2d coordinates
    init(list) {
        this.points = [];
        this.segments = [];
        this.faces = [];

        // Only one face
        for (let i = 0; i < list.length; i += 2) {
            // xf,yf,x,y,z
            this.addPoint(list[i], list[i + 1], list[i], list[i + 1], 0);
        }
        // Make a shallow copy, one face with points and segments
        this.addFace(this.points.slice(0, this.points.length));

        return this;
    }

    // Get first point near xf, yf
    getPoint2d(xf, yf) {
        for (let i = 0; i < this.points.length; i++) {
            let p = this.points[i];
            let df = Math.sqrt((p.xf - xf) * (p.xf - xf) + (p.yf - yf) * (p.yf - yf));
            if (df < 10) {
                return p;
            }
        }
        return null;
    }

    // Get first segment near xf, yf
    getSegment2d(xf, yf) {
        const p = new Point(xf, yf, 0, 0, 0);
        for (let i = 0; i < this.segments.length; i++) {
            let s = this.segments[i];
            let d = Segment.distanceToPoint2d(s, p);
            if (d < 10) {
                return s;
            }
        }
        return null;
    }

    // Get first point near x, y, z
    getPoint3d(x, y, z) {
        for (let i = 0; i < this.points.length; i++) {
            let p = this.points[i];
            let d = Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.z - z);
            if (d < 10) {
                return p;
            }
        }
        return null;
    }

    // Add a point, or return existing point
    addPoint(xf, yf, x, y, z) {
        let point = null;
        this.points.forEach((p) => {
            let df = Math.abs(p.xf - xf) + Math.abs(p.yf - yf);
            let d = Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.z - z);
            if (df + d < 1) {
                point = p;
            }
        })
        if (!point) {
            point = new Point(xf, yf, x, y, z);
            this.points.push(point);
        }
        return point;
    }

    // Add a segment, or return existing segment
    addSegment(a, b) {
        let segment = this.searchSegmentTwoPoints(a, b);
        if (!segment) {
            a = this.addPoint(a.xf, a.yf, a.x, a.y, a.z);
            b = this.addPoint(b.xf, b.yf, b.x, b.y, b.z);
            segment = new Segment(a, b);
            this.segments.push(segment);
        }
        return segment;
    }

    // Add a face, or return existing face
    addFace(points) {
        let face = null;
        this.faces.forEach((f) => {
            if (points === f.points) {
                face = f;
            }
        })
        if (!face) {
            face = new Face(points);
            this.faces.push(face);
            // Add segments for face
            face.points.forEach((p, i, a) => {
                a[i] = this.addPoint(p.xf, p.yf, p.x, p.y, p.z);
                this.addSegment(p, a[(i + 1) % a.length]);
            });
        }
        return face;
    }

    // Origami
    // Split Face f by plane pl
    splitFaceByPlane(face, plane) {

        // Split face, return one or two polygons
        let [left, right] = Face.splitByPlane3d(face, plane, this);

        if (left && right) {
            // Add left
            this.addFace(left);
            // Add right
            this.addFace(right);
            // Remove face
            let index = this.faces.indexOf(face);
            this.faces.splice(index, 1);
        }
    }

    // Split all or given faces by a plane
    splitAllFacesByPlane(plane, faces) {
        faces = faces ? faces : this.faces;

        // Reverse order to safely add new faces
        for (let i = faces.length - 1; i > -1; i--) {
            const face = faces[i];
            this.splitFaceByPlane(face, plane);
        }
    }

    // Split faces across two points
    splitAcross(p1, p2, faces) {
        const plane = Plane.across(p1, p2);
        this.splitAllFacesByPlane(plane, faces);
    }

    // Split faces by a plane passing by two points on xy orthogonal to z
    splitBy(p1, p2, faces) {
        const plane = Plane.by(p1, p2);
        this.splitAllFacesByPlane(plane, faces);
    }

    // Split faces by a plane orthogonal to [p1,p2] passing by point
    splitOrthogonal(p1, p2, point, faces) {
        const plane = Plane.orthogonal(p1, p2, point);
        this.splitAllFacesByPlane(plane, faces);
    }

    // Split faces by a plane between two lines [ab] [cd]
    splitLineToLine(a, b, c, d, faces) {
        const {p, q} = Segment.closestSegment(a, b, c, d);

        // closestLine is just one point
        if (p.x === q.x && p.y === q.y && p.z === q.z) {
            // Choose points a and c far from center p (which could be a or c)
            a = Vector3.sub(a, p).length() > Vector3.sub(b, p).length() ? a : b;
            c = Vector3.sub(c, p).length() > Vector3.sub(d, p).length() ? c : d;
            this.splitLineToLineByPoints(a, p, c, faces);
        } else {
            // Lines do not cross, parallel
            const plane = Plane.across(a, d);
            this.splitAllFacesByPlane(plane, faces);
        }
    }

    // Split faces by a plane between two segments [ap] [pc].
    splitLineToLineByPoints(a, p, c, faces) {
        // Project [a] on [p c] to get a symmetric point
        const ap = Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) + (p.z - a.z) * (p.z - a.z));
        const cp = Math.sqrt((p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y) + (p.z - c.z) * (p.z - c.z));
        const k = ap / cp;
        // e is on pc symmetric of a
        const e = new Vector3(p.x + k * (c.x - p.x), p.y + k * (c.y - p.y), p.z + k * (c.z - p.z));
        // Define Plane across a and e
        const plane = Plane.across(a, e);
        this.splitAllFacesByPlane(plane, faces);
    }

    // Rotate points around axis [a,b] by angle
    rotate(a, b, angle, points) {
        const angleRd = angle * Math.PI / 180.0;
        const ax = a.x, ay = a.y, az = a.z;
        let nx = b.x - ax, ny = b.y - ay, nz = b.z - az;
        const n = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx *= n;
        ny *= n;
        nz *= n;
        const sin = Math.sin(angleRd), cos = Math.cos(angleRd);
        points.forEach((p) => this.turnPoint(p, ax, ay, az, nx, ny, nz, sin, cos));
    }

    // Adjust one point 3d with 2d length of segments
    adjust(point, segments) {
        // Take all segments containing point p or given list
        segments = segments || this.searchSegmentsOnePoint(point);
        let max = 100;
        // Kaczmarz or Verlet
        // Iterate while length difference between 2d and 3d is > 1e-3
        for (let i = 0; max > 0.001 && i < 20; i++) {
            max = 0;
            // Iterate over all segments
            // Pm is the medium point
            const pm = new Vector3(0, 0, 0);
            for (let j = 0; j < segments.length; j++) {
                const s = segments[j];
                const lg3d = s.length3d();
                const lg2d = s.length2d(); // Should not change
                const d = (lg2d - lg3d);
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
                // Move B = A + AB * r with r = l2d / l3d
                // AB * r is based on length 3d to match length 2d
                const r = (lg2d / lg3d);
                if (s.p2 === point) {
                    // move p2
                    pm.x += s.p1.x + (s.p2.x - s.p1.x) * r;
                    pm.y += s.p1.y + (s.p2.y - s.p1.y) * r;
                    pm.z += s.p1.z + (s.p2.z - s.p1.z) * r;
                } else if (s.p1 === point) {
                    // move p1
                    pm.x += s.p2.x + (s.p1.x - s.p2.x) * r;
                    pm.y += s.p2.y + (s.p1.y - s.p2.y) * r;
                    pm.z += s.p2.z + (s.p1.z - s.p2.z) * r;
                }
            }
            // Set Point with average position taking all segments
            if (segments.length !== 0) {
                point.x = pm.x / segments.length;
                point.y = pm.y / segments.length;
                point.z = pm.z / segments.length;
            }
        }
        return max;
    }

    // Adjust list of points 3d
    adjustList(list) {
        let max = 100;
        for (let i = 0; max > 0.001 && i < 100; i++) {
            max = 0;
            for (let j = 0; j < list.length; j++) {
                const point = list[j];
                const segments = this.searchSegmentsOnePoint(point);
                const d = this.adjust(point, segments);
                if (Math.abs(d) > max) {
                    max = Math.abs(d);
                }
            }
        }
        return max;
    }

    // Search segments containing Point a
    searchSegmentsOnePoint(a) {
        const list = [];
        this.segments.forEach(function (s) {
            if (s.p1 === a || s.p2 === a) list.push(s);
        });
        return list;
    }

    // Search segment containing Points a and b
    searchSegmentTwoPoints(a, b) {
        for (let i = 0; i < this.segments.length; i++) {
            let s = this.segments[i];
            if (
                (s.p1.xf === a.xf && s.p1.yf === a.yf && s.p1.x === a.x && s.p1.x === a.x && s.p1.z === a.z
                    && s.p2.xf === b.xf && s.p2.yf === b.yf && s.p2.x === b.x && s.p2.x === b.x && s.p2.z === b.z)
                || (s.p1.xf === b.xf && s.p1.yf === b.yf && s.p1.x === b.x && s.p1.x === b.x && s.p1.z === b.z
                    && s.p2.xf === a.xf && s.p2.yf === a.yf && s.p2.x === a.x && s.p2.x === a.x && s.p2.z === a.z))
                return s;
        }
        return null;
    }

    // Search faces containing segment [a, b]
    searchFaces(a, b) {
        let faces = [];
        this.faces.forEach((f) => {
            if (f.points.indexOf(b) !== -1 && f.points.indexOf(a) !== -1) {
                // Should test if a and b are adjacent ?
                faces.push(f);
            }
        });
        return faces;
    }

    // Move list of points by dx,dy,dz
    move(points, dx, dy, dz) {
        points = points ? this.points : points;
        points.forEach(function (p) {
            p.x += dx;
            p.y += dy;
            p.z += dz;
        });
    }

    // Move on a point p0 all following points, k from 0 to 1 for animation
    moveOn(p0, k1, k2, points) {
        points.forEach(function (p) {
            p.x = p0.x * k1 + p.x * k2;
            p.y = p0.y * k1 + p.y * k2;
            p.z = p0.z * k1 + p.z * k2;
        });
    }

    // Move given or all points to z = 0
    flat(points) {
        points = points ? points : this.points;
        points.forEach((point) => point.z = 0)
    }

    // Turn model around axis by  angle
    turn(axe, angle) {
        angle *= Math.PI / 180.0;
        const ax = 0, ay = 0, az = 0;
        let nx = 0.0, ny = 0.0, nz = 0.0;
        if (axe === 1) {
            nx = 1.0;
        } else if (axe === 2) {
            ny = 1.0;
        } else if (axe === 3) {
            nz = 1.0;
        }
        const n = (1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz));
        nx *= n;
        ny *= n;
        nz *= n;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        this.points.forEach((p) => this.turnPoint(p, ax, ay, az, nx, ny, nz, sin, cos));
    }

    turnPoint(p, ax, ay, az, nx, ny, nz, sin, cos) {
        const c1 = 1.0 - cos;
        const c11 = c1 * nx * nx + cos, c12 = c1 * nx * ny - nz * sin, c13 = c1 * nx * nz + ny * sin;
        const c21 = c1 * ny * nx + nz * sin, c22 = c1 * ny * ny + cos, c23 = c1 * ny * nz - nx * sin;
        const c31 = c1 * nz * nx - ny * sin, c32 = c1 * nz * ny + nx * sin, c33 = c1 * nz * nz + cos;
        const ux = p.x - ax, uy = p.y - ay, uz = p.z - az;
        p.x = ax + c11 * ux + c12 * uy + c13 * uz;
        p.y = ay + c21 * ux + c22 * uy + c23 * uz;
        p.z = az + c31 * ux + c32 * uy + c33 * uz;
    }

    // Offset faces by dz
    offset(dz, faces) {
        faces.forEach(function (face) {
            face.offset += dz;
        });
    }

    // 2d Boundary [xMin, yMin, xMax, yMax]
    get2DBounds() {
        let xMax = -100.0;
        let xMin = 100.0;
        let yMax = -100.0;
        let yMin = 100.0;
        this.points.forEach(function (p) {
            const x = p.xf, y = p.yf;
            if (x > xMax) xMax = x;
            if (x < xMin) xMin = x;
            if (y > yMax) yMax = y;
            if (y < yMin) yMin = y;
        });
        const obj = {};
        obj.xMin = xMin;
        obj.yMin = yMin;
        obj.xMax = xMax;
        obj.yMax = yMax;
        return obj;
    }
}

class Point {

    constructor(xf = 0, yf = 0, x = 0, y = 0, z = 0) {
        this.xf = Number(xf);
        this.yf = Number(yf);
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
    }

    // Adjust point i 2d coords on segment ab
    static adjustFrom3d(a, b, i) {
        // Length from a to i in 3d
        const ai = Math.sqrt((i.x - a.x) * (i.x - a.x) + (i.y - a.y) * (i.y - a.y) + (i.z - a.z) * (i.z - a.z));
        // Length from a to b in 3d
        const ab = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) + (b.z - a.z) * (b.z - a.z));
        // Ratio t from
        const t = ai / ab;
        // Set 2d to the same ratio
        i.xf = a.xf + t * (b.xf - a.xf);
        i.yf = a.yf + t * (b.yf - a.yf);
    }

    // Adjust point i 3d coords on segment ab
    static adjustFrom2d(a, b, i) {
        // Length from a to i in 2d
        const ai = Math.sqrt((i.xf - a.xf) * (i.xf - a.xf) + (i.yf - a.yf) * (i.yf - a.yf));
        // Length from a to b in 2d
        const ab = Math.sqrt((b.xf - a.xf) * (b.xf - a.xf) + (b.yf - a.yf) * (b.yf - a.yf));
        // Ratio t from
        const t = ai / ab;
        // Set 3d to the same ratio
        i.x = a.x + t * (b.x - a.x);
        i.y = a.y + t * (b.y - a.y);
        i.z = a.z + t * (b.z - a.z);
    }

    set(xf = 0, yf = 0, x = 0, y = 0, z = 0) {
        this.xf = xf;
        this.yf = yf;
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class Segment {

    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }

    // 2d distance from Segment to Point
    static distanceToPoint2d = function (seg, pt) {
        const x1 = seg.p1.xf;
        const y1 = seg.p1.yf;
        const x2 = seg.p2.xf;
        const y2 = seg.p2.yf;
        const x = pt.xf;
        const y = pt.yf;
        const l2 = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
        const r = ((y1 - y) * (y1 - y2) + (x1 - x) * (x1 - x2)) / l2;
        const s = ((y1 - y) * (x2 - x1) - (x1 - x) * (y2 - y1)) / l2;
        let d;
        if (r <= 0) {
            d = Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        } else if (r >= 1) {
            d = Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));
        } else {
            d = (Math.abs(s) * Math.sqrt(l2));
        }
        return d;
    };

    // Area counter clock wise, CCW, gives indication of 2d signed distance between Point and Segment
    static CCW = function CCW(a, b, c) {
        return (a.xf - c.xf) * (b.yf - c.yf) - (a.yf - c.yf) * (b.xf - c.xf);
    }

    // 2d intersection between two lines ab and cd
    static intersection2d(a, b, c, d) {
        // Collinear case, maybe overcomplicated
        function collinear(a, b, c, d) {
            // length
            let ab = (b.xf - a.xf) * (b.xf - a.xf) + (b.yf - a.yf) * (b.yf - a.yf);
            let cd = (d.xf - c.xf) * (d.xf - c.xf) + (d.yf - c.yf) * (d.yf - c.yf);
            // degenerated cases
            if (ab === 0) {
                if (cd === 0) {
                    return a.xf === c.xf ? a : null;
                }
                // project 'a' on 'cd'
                let t = a.xf * (c.xf - d.xf) + a.yf * (c.yf - d.yf);
                if (t < 0 || t > 1) {
                    return null;
                }
                return a;
            }
            // project a,b,c,d on segment ab which is not degenerated
            let tc = ((b.xf - a.xf) * c.xf + (b.yf - a.yf) * c.yf) / ab;
            let td = ((b.xf - a.xf) * d.xf + (b.yf - a.yf) * d.yf) / ab;
            if (tc < 0) { // c on the left of ab
                if (td < 0) { // d on the left of ab
                    return null;
                } else if (td > 1) { // d on the right of ab
                    return a; // could be a or b
                }
                return d; // d between a and b, could return a or d
            } else if (tc > 1) { // c on the right of ab
                if (td > 1) {  // d on the right of ab
                    return null;
                } else if (td > 1) {
                    return a; // could be a or b
                }
                return d; // d between a and b, could return b or d
            }
            return c; // could be c or b
        }

        // Area from ab to d and from ab to c
        const a1 = Segment.CCW(a, b, d);
        const a2 = Segment.CCW(a, b, c);

        // Intersection
        if (a1 * a2 <= 0.0) {
            const a3 = Segment.CCW(c, d, a);
            const a4 = a3 + a2 - a1;
            if (a3 * a4 <= 0.0) {
                if (a3 - a4 === 0) {
                    return collinear(a, b, c, d);
                } else {
                    const t = a3 / (a3 - a4);
                    return new Vector2(a.xf + t * (b.xf - a.xf), a.yf + t * (b.yf - a.yf));
                }
            }
        }
        return null;
    }

    // Basic intersection used for tests, does not handle collinear, or superposed
    static intersection2dBasic(a, b, c, d) {
        let v1_x, v1_y, v2_x, v2_y;
        v1_x = b.xf - a.xf;
        v1_y = b.yf - a.yf;
        v2_x = d.xf - c.xf;
        v2_y = d.yf - c.yf;
        let s, t;
        s = (-v1_y * (a.xf - c.xf) + v1_x * (a.yf - c.yf)) / (-v2_x * v1_y + v1_x * v2_y);
        t = (v2_x * (a.yf - c.yf) - v2_y * (a.xf - c.xf)) / (-v2_x * v1_y + v1_x * v2_y);
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            let x = a.xf + (t * v1_x);
            let y = a.yf + (t * v1_y);
            return new Vector2(x, y);
        }
        return null;
    }

    // 3d distance from segment to segment
    static distanceToSegment = function (A, B, C, D) {
        let {p, q} = Segment.closestSegment(A, B, C, D);
        const pq = new Vector3(q.x - p.x, q.y - p.y, q.z - p.z);
        return pq.length();
    }

        // Closest points between line [A,B] and line [C, D] return {p, q}
    static closestSegment(A, B, C, D) {
        // On AB segment we have : P(t1)=A+t1*(B-C)
        // On CD segment we have : Q(t2)=C.p1+t2*(D-C)
        // Vector PQ perpendicular to both lines : PQ(t1,t2).AB=0  PQ(t1,t2).CD=0
        // Cramer system :
        // (AB.AB)*t1 - (AB.CD)*t2 = -AB.r <=> a*t1 -b*t2 = -c
        // (AB.CD)*t1 - (CD.CD)*t2 = -CD.r <=> b*t1 -e*t2 = -f
        // Solved to t1=(bf-ce)/(ae-bb) t2=(af-bc)/(ae-bb)
        let t1, t2, closest;
        const AB = new Vector3(B.x - A.x, B.y - A.y, B.z - A.z);
        const CD = new Vector3(D.x - C.x, D.y - C.y, D.z - C.z);
        const CA = new Vector3(A.x - C.x, A.y - C.y, A.z - C.z); // C to A
        const a = AB.dot(AB); // squared length of AB
        const e = CD.dot(CD); // squared length of CD
        const f = CD.dot(CA);
        // Check degeneration of segments into points
        if (a < 1 && e < 1) {
            // Both degenerate into points
            t1 = t2 = 0.0;
            closest = {p: A, q: C};
        } else {
            if (a < 1) {
                // AB segment degenerate into point
                t1 = 0.0;
                t2 = f / e; // t1=0 => t2=(b*t1+f)/e = f/e // f = 0 ??
            } else {
                const c = AB.dot(CA);
                if (e < 1) {
                    // CD segment degenerate into point
                    t2 = 0.0;
                    t1 = -c / a; // t2=0 => t1=(b*t2-c)/a = -c/a
                } else {
                    // General case
                    const b = AB.dot(CD); // Delayed computation of b
                    const denominator = a * e - b * b; // Denominator of cramer system
                    // Segments not parallel, compute closest
                    if (denominator !== 0.0) {
                        t1 = (b * f - c * e) / denominator;
                    } else {
                        // Arbitrary point, here 0 => p1
                        t1 = 0;
                    }
                    // Compute the closest on CD using t1
                    t2 = (b * t1 + f) / e;
                    // if t2 in [0,1] done, else clamp t2 and recompute t1
                    if (t2 < 0.0) {
                        t2 = 0;
                        t1 = -c / a;
                        t1 = t1 < 0 ? 0 : t1 > 1 ? 1 : t1;
                    } else if (t2 > 1.0) {
                        t2 = 1.0;
                        t1 = (b - c) / a;
                        t1 = t1 < 0 ? 0 : t1 > 1 ? 1 : t1;
                    }
                }
            }
            const P = new Vector3(A.x, A.y, A.z).add(AB.scale(t1)); // P = a+t1*(b-a)
            const Q = new Vector3(C.x, C.y, C.z).add(CD.scale(t2)); // Q = c+t2*(d-c)
            closest = {p: P, q: Q};
        }
        return closest;
    }

    // 3d length
    length3d() {
        return Math.sqrt((this.p1.x - this.p2.x) * (this.p1.x - this.p2.x) + (this.p1.y - this.p2.y) * (this.p1.y - this.p2.y) + (this.p1.z - this.p2.z) * (this.p1.z - this.p2.z));
    }

    // 2d length
    length2d() {
        return Math.sqrt((this.p1.xf - this.p2.xf) * (this.p1.xf - this.p2.xf) + (this.p1.yf - this.p2.yf) * (this.p1.yf - this.p2.yf));
    }

}

class Face {

    constructor(points) {
        this.points = points || [];
    }

    static area2d(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            area += points[i].xf * points[(i + 1) % points.length].yf - points[i].yf * points[(i + 1) % points.length].xf;
        }
        return area / 2;
    }

    // Split 2d face by 2d line passing by points a and b
    static splitByTwoPoint2d(face, a, b) {
        let left = [];
        let right = [];
        let points = face.points;

        // Begin with last point
        let last = points[points.length - 1];
        let distanceToLast = Segment.CCW(a, b, last);

        for (let n = 0; n < points.length; n++) {
            const current = points[n];
            const distanceToCurrent = Segment.CCW(a, b, current);
            // on same side
            if (distanceToLast * distanceToCurrent > 0) {
                distanceToCurrent > 0 ? left.push(current) : right.push(current);
            }
            // current on plane
            else if (distanceToCurrent === 0) {
                left.push(current);
                right.push(current);
            }
            // last on plane
            else if (distanceToLast === 0) {
                distanceToCurrent > 0 ? left.push(current) : right.push(current);
            }
            // on different side, crossing
            else {
                let vector2 = Segment.intersection2d(a, b, last, current);
                let intersection = new Point(vector2.xf, vector2.yf, 0, 0, 0);
                left.push(intersection);
                right.push(intersection);
                distanceToCurrent > 0 ? left.push(current) : right.push(current);
                // Origami adjust intersection 3d coordinates
                Point.adjustFrom2d(last, current, intersection)
            }
            last = current;
            distanceToLast = distanceToCurrent;
        }
        // Discard degenerated polygons artefacts
        left = Face.area2d(left) !== 0 ? left : null;
        right = Face.area2d(right) !== 0 ? right : null;
        return [left, right];
    }

    // Split 3d face by 3d plane
    static splitByPlane3d(face, plane, model = null) {
        let left = [];
        let right = [];
        let points = face.points;

        // Begin with last point
        let last = points[points.length - 1];
        let dLast = plane.distanceToPoint(last);

        for (let n = 0; n < points.length; n++) {
            const current = points[n];
            const dCurrent = plane.distanceToPoint(current);
            // on same side
            if (dLast * dCurrent > 0) {
                dCurrent < 0 ? left.push(current) : right.push(current);
            }
            // current on plane
            else if (dCurrent === 0) {
                left.push(current);
                right.push(current);
            }
            // last on plane
            else if (dLast === 0) {
                dCurrent < 0 ? left.push(current) : right.push(current);
            }
            // on different side, crossing
            else {
                let inter = plane.intersection3d(last, current);
                left.push(inter);
                right.push(inter);
                dCurrent < 0 ? left.push(current) : right.push(current);

                // if Origami model provided
                if (model) {
                    Point.adjustFrom3d(last, current, inter);
                    model.addPoint(inter.xf, inter.yf, inter.x, inter.y, inter.z);

                    // Remove segment
                    let segment = model.searchSegmentTwoPoints(last, current);
                    let index = model.segments.indexOf(segment);
                    model.segments.splice(index, 1);
                }
            }
            last = current;
            dLast = dCurrent;
        }
        // Discard degenerated polygons artefacts
        left = Face.area2d(left) !== 0 ? left : null;
        right = Face.area2d(right) !== 0 ? right : null;
        return [left, right];
    }
}

class Plane {

    constructor(normal, distance) {
        this.normal = normal.normalize();
        this.distance = distance;
    }

    // Plane across 2 points
    static across = function (p1, p2) {
        const normal = new Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const middle = new Vector3((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
        const distance = normal.normalize().dot(middle);
        return new Plane(normal, distance);
    };

    // Plane by 2 points on xy orthogonal to z
    static by = function (p1, p2) {
        const normal = new Vector3((p2.y - p1.y), -(p2.x - p1.x), 0).normalize();
        const distance = normal.dot(p1);
        return new Plane(normal, distance);
    };

    // Plane orthogonal to a segment passing by a point
    static orthogonal = function (v1, v2, p) {
        const normal = new Vector3(v2.x - v1.x, v2.y - v1.y, v2.z - v1.z);
        const distance = new Vector3(p.x, p.y, p.z).dot(normal);
        return new Plane(normal, distance);
    }

    // Signed distance assume normal to be normalized
    distanceToPoint(point) {
        return this.normal.dot(point) - this.distance;
    }

    // Intersection with segment defined by two points
    intersection3d(a, b) {
        // (A+tAB).N = d <=> t = (d-A.N) / (AB.N) then Q=A+tAB 0<t<1
        const ab = new Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
        const abf = new Vector2(b.xf - a.xf, b.yf - a.yf);
        const abn = this.normal.dot(ab);
        // segment parallel to plane
        if (abn === 0) return null;
        // segment crossing
        const t = (this.distance - this.normal.dot(a)) / abn;
        if (t >= 0 && t <= 1.0) {
            ab.scale(t);
            abf.scale(t);
            return new Point(a.xf + abf.xf, a.yf + abf.yf, a.x + ab.x, a.y + ab.y, a.z + ab.z);
        }
        return null;
    }

}

class Vector2 {

    constructor(xf = 0, yf = 0) {
        this.xf = xf;
        this.yf = yf;
    }

    dot(v) {
        return this.xf * v.xf + this.yf * v.yf;
    }

    scale(t) {
        this.xf *= t;
        this.yf *= t;
    }

    length() {
        return Math.sqrt(this.xf * this.xf + this.yf * this.yf);
    }
}

class Vector3 {

    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    static sub(a, b) {
        return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static crossVectors(a, b) {
        const ax = a.x, ay = a.y, az = a.z;
        const bx = b.x, by = b.y, bz = b.z;
        let x = ay * bz - az * by;
        let y = az * bx - ax * bz;
        let z = ax * by - ay * bx;
        return new Vector3(x, y, z);
    }

    // Closest point between point C and line [A,B] return P on line AB
    static closestPoint(C, A, B) {
        // Vector AB and AC
        const AB = new Vector3(B.x - A.x, B.y - A.y, B.z - A.z);
        const AC = new Vector3(C.x - A.x, C.y - A.y, C.z - A.z);
        // Project C on AB d(t) = A + t * AB
        const ab = AB.dot(AB);
        const t = ab === 0 ? 0 : AC.dot(AB) / ab;
        // P = a+t*(b-a)
        return new Vector3(A.x, A.y, A.z).add(AB.scale(t));
    }

    // Distance between point C and line [A,B] return number
    static pointLineDistance(C, A, B) {
        const AC = Vector3.sub(C, A);
        const BC = Vector3.sub(C, B);
        const cross = Vector3.crossVectors(AC, BC);
        const AB = Vector3.sub(B, A);
        const ab = AB.length();
        return ab === 0 ? AC.length() : cross.length() / ab;
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    scale(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalize() {
        return this.scale(1 / this.length());
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
}

export {Model, Point, Segment, Face, Vector2, Vector3, Plane};
