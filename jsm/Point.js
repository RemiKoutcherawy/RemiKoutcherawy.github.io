export class Point {

    constructor(xf, yf, x=0, y=0, z=0) {
        this.xf = Number(xf);
        this.yf = Number(yf);
        this.x = Number(x);
        this.y = Number(y);
        this.z = Number(z);
        // Helper
        this.hover = false;
        this.select = 0;
    }

    // Adjust point i 2d coords on segment ab
    static align2dFrom3d(a, b, i) {
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
    static align3dFrom2d(a, b, i) {
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

    // Distance
    static distance2d(a, b) {
        return Math.sqrt((b.xf - a.xf) * (b.xf - a.xf) + (b.yf - a.yf) * (b.yf - a.yf));
    }

    // Normalize as if Vector 2d
    static normalise(a) {
        const length = Math.sqrt(a.xf * a.xf + a.yf * a.yf);
        return {xf: a.xf / length, yf: a.yf / length};
    }
}
// 54 lines
