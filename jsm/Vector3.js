export class Vector3 {

    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // The closest point between point C and segment [A, B] return Vector3 on segment AB
    static closestPoint(C, A, B) {
        // Vector AB and AC
        const AB = new Vector3(B.x - A.x, B.y - A.y, B.z - A.z);
        const AC = new Vector3(C.x - A.x, C.y - A.y, C.z - A.z);
        // Project C on AB d(t) = A + t * AB
        const ab = Vector3.dot(AB, AB);
        const t = ab === 0 ? 0 : Vector3.dot(AC, AB) / ab;
        // P = a+t*(b-a)
        return new Vector3(A.x + AB.x * t, A.y + AB.y * t, A.z + AB.z * t);
    }

    // Distance between point C and line [A, B] return number
    static pointLineDistance(C, A, B) {
        const AC = Vector3.sub(C, A);
        const BC = Vector3.sub(C, B);
        const cross = Vector3.cross(AC, BC);
        const AB = Vector3.sub(B, A);
        const ab = Vector3.length3d(AB);
        return ab === 0 ? Vector3.length3d(AC) : Vector3.length3d(cross) / ab;
    }

    static dot(u, v) {
        return u.x * v.x + u.y * v.y + u.z * v.z;
    }

    static scale(v, scalar) {
        v.x *= scalar;
        v.y *= scalar;
        v.z *= scalar;
        return v;
    }

    static length3d(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    static normalize(v) {
        return Vector3.scale(v, 1 / Vector3.length3d(v));
    }

    static add(u, v) {
        const x = u.x + v.x;
        const y = u.y + v.y;
        const z = u.z + v.z;
        return new Vector3(x, y, z);
    }

    static sub(a, b) {
        return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    static cross(a, b) {
        const ax = a.x, ay = a.y, az = a.z;
        const bx = b.x, by = b.y, bz = b.z;
        const x = ay * bz - az * by;
        const y = az * bx - ax * bz;
        const z = ax * by - ay * bx;
        return new Vector3(x, y, z);
    }
}

// 70
