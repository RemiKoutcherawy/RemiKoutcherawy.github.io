// Interprets a list of commands and apply them on Model
import {Interpolator} from './Interpolator.js';
import {Segment} from './Segment.js';
import {Point} from './Point.js';
import {State} from './Model.js';

export class Command {
    model; // Current model
    // Tokenized commands
    tokenTodo = [];
    iToken = 0;
    done = []; // List of model states
    instructions = []; // List of commands done
    // Time interpolated at an instant 'p' preceding and at instant 'n' now
    tpi = 0;
    tni = 1;
    // scale, cx, cy, cz used in ZoomFit
    za = [0, 0, 0, 0];
    // Interpolator used in anim() to map tn (time normalized) to tni (time interpolated)
    interpolator = Interpolator.LinearInterpolator;
    // Animation
    duration = 0;
    tStart = 0;
    // Eventual CommandArea
    commandArea;

    constructor(model) {
        this.model = model;
    }

    // The main entry point executes a string of commands
    command(cde) {
        if (this.commandArea !== undefined) {
            this.commandArea.addLine(cde);
        }
        // Define
        if (cde.startsWith('d') || cde.startsWith('define')) {
            // Reset
            this.done = [];
            this.tokenTodo = [];
            this.iToken = 0;
            this.instructions = [];
        }
        // Undo
        else if (cde === 'u' || cde === 'undo') {
            // Current is removed
            this.done.pop();
            // Last will be restored
            this.model.state = State.undo;
            // return early, no need to tokenize
            return this;
        }
        // Tokenize and push
        this.tokenTodo.push(...this.tokenize(cde));
        return this;
    }

    // Tokenize, split the input String in Array of String
    tokenize = function tokenize(input) {
        let text = input.replace(/\/\/.*$/mg, ''); // Remove comments
        text = text.replace(/([);\n])|(\)\n)/g, ' eoc '); // ) or ; or \n => end of command
        return text.split(/\s+/).filter(e => e !== '')
    }

    // State machine returns true if the model needs redrawing
    // Only 4 states: run, anim, undo, pause
    // Called by requestAnimationFrame(loop)
    anim() {
        if (this.model.state === State.pause) {
            // Nothing to do
            return false;
        }
        // If running
        else if (this.model.state === State.run) {
            // Nothing to do
            if (this.iToken >= this.tokenTodo.length) {
                return false;
            } else {
                this.idxBefore = this.iToken;
                // Handle time command to start animation and switch to Anim
                if (this.tokenTodo[this.iToken] === 't' || this.tokenTodo[this.iToken] === 'time') {
                    this.iToken++;
                    this.duration = Number(this.tokenTodo[this.iToken++]);
                    this.tStart = performance.now();
                    this.tpi = 0.0;
                    // State anim for the next call
                    this.model.state = State.anim;
                    return true;
                }

                // Execute one command starting at this.iToken
                this.execute(this.iToken);

                // Keep track of done
                this.doneInstructions(this.idxBefore, this.iToken);
                return true;
            }
        }
        // Handle undo
        else if (this.model.state === State.undo) {
            // Restore model
            this.popUndo();
            // Continue undo if the model was in animation
            if (this.model.state === State.anim) {
                this.model.state = State.undo;
            }
            return true;
        }
        // Animation in progress
        else if (this.model.state === State.anim) {
            // Compute tn varying from 0 to 1
            const t = performance.now();
            let tn = (t - this.tStart) / this.duration;
            tn = (tn > 1.0) ? 1.0 : tn;
            this.tni = this.interpolator(tn);
            // Execute commands after t xxx up to including eoc
            let iBeginAnim = this.iToken;
            while (this.tokenTodo[this.iToken] !== 'eoc') {
                this.execute(this.iToken);
            }
            // t preceding (tpi) is now to t now (tni)
            this.tpi = this.tni; // t preceding
            // If Animation is finished, set end values
            if (tn >= 1.0) {
                this.tni = 1.0;
                this.tpi = 0.0;
                // Keep track of done
                this.doneInstructions(this.idxBefore, this.iToken);
                // No more animation State run for the next call
                this.model.state = State.run;
                return true;
            }
            // Rewind to continue animation
            this.iToken = iBeginAnim;
            return true;
        }
        console.log('unhandled state', Object.keys(State)[this.model.state]);
        return false;
    }

    doneInstructions(idxBefore, idxAfter) {
        // Keep track of commands done
        let doneCommands = this.tokenTodo.slice(idxBefore, idxAfter).join(' ');
        if (doneCommands !== '' && doneCommands !== 'eoc') {
            if (doneCommands !== 'undo') {
                this.instructions.push(doneCommands);
            } else {
                this.instructions.pop();
            }
        }
    }

    // Execute one instruction from tokenTodo starting at idx on the model
    execute(idx) {
        let list = [];
        const tokenList = this.tokenTodo;
        const k = this.tni - this.tpi; // For animation

        // Define sheet
        if (tokenList[idx] === 'd' || tokenList[idx] === 'define') {
            // Define a sheet by N points x,y CCW
            idx++;
            const width = !isNaN(Number(tokenList[idx])) ? Number(tokenList[idx++]) : 200;
            const height = !isNaN(Number(tokenList[idx])) ? Number(tokenList[idx++]) : 200;
            this.model.init(width, height);
            // this.command('fit'); // Fits 3D but breaks tests!
        }

        // Origami splits
        else if (tokenList[idx] === 'by3d') {
            // Split by two points in 3d: b3d p1 p2
            idx++;
            let p1 = this.model.points[tokenList[idx++]];
            let p2 = this.model.points[tokenList[idx++]];
            this.model.splitBy3d(p1, p2);
        } else if (tokenList[idx] === 'by2d') {
            // Split by two points in 2d on the crease pattern: by 2d p1 p2
            idx++;
            let p1 = this.model.points[tokenList[idx++]];
            let p2 = this.model.points[tokenList[idx++]];
            this.model.splitBy2d(p1, p2);
        } else if (tokenList[idx] === 'c3d' || tokenList[idx] === 'across3d' || tokenList[idx] === 'cross3d') {
            // Split across two points in 3d: c3d p1 p2;
            idx++;
            let p1 = this.model.points[tokenList[idx++]];
            let p2 = this.model.points[tokenList[idx++]];
            this.model.splitCross3d(p1, p2);
        } else if (tokenList[idx] === 'c2d' || tokenList[idx] === 'across2d') {
            // Split across two points on 2d the crease pattern: c2d p1 p2;
            idx++;
            let p1 = this.model.points[tokenList[idx++]];
            let p2 = this.model.points[tokenList[idx++]];
            this.model.splitCross2d(p1, p2);
        } else if (tokenList[idx] === 'p2d' || tokenList[idx] === 'perpendicular2d') {
            // Split perpendicular to segment by point in 2d: p s1 p1;
            idx++;
            const s = this.model.segments[tokenList[idx++]];
            let p = this.model.points[tokenList[idx++]];
            this.model.splitPerpendicular2d(s, p);
        } else if (tokenList[idx] === 'p3d' || tokenList[idx] === 'perpendicular3d') {
            // Split perpendicular to segment by point in 3d: p s1 p1;
            idx++;
            const s = this.model.segments[tokenList[idx++]];
            let p = this.model.points[tokenList[idx++]];
            this.model.splitPerpendicular3d(s, p);
        } else if (tokenList[idx] === 'bisector2d') {
            // Split by a line passing between segments: s2d s1 s2;
            idx++;
            const s1 = this.model.segments[tokenList[idx++]];
            const s2 = this.model.segments[tokenList[idx++]];
            this.model.bisector2d(s1, s2);
        } else if (tokenList[idx] === 'bisector3d') {
            // Split by a plane passing between segments: s1 s2;
            idx++;
            const s1 = this.model.segments[tokenList[idx++]];
            const s2 = this.model.segments[tokenList[idx++]];
            this.model.bisector3d(s1.p1, s1.p2, s2.p1, s2.p2);
        } else if (tokenList[idx] === 'bisector2dPoints') {
            // Split by a line bisector of 3 points A B C. B is in the middle
            idx++;
            let a = this.model.points[tokenList[idx++]];
            let b = this.model.points[tokenList[idx++]];
            let c = this.model.points[tokenList[idx++]];
            this.model.bisector2dPoints(a, b, c);
        }  else if (tokenList[idx] === 'bisector3dPoints') {
            // Split by a plane bisector of 3 points A B C. B is in the middle
            idx++;
            let a = this.model.points[tokenList[idx++]];
            let b = this.model.points[tokenList[idx++]];
            let c = this.model.points[tokenList[idx++]];
            this.model.bisector3dPoints(a, b, c);
        }

        // Segments splits
        else if (tokenList[idx] === 'splitSegment2d') { // "s: split segment numerator denominator"
            // Split segment by N/D
            idx++;
            const s = this.model.segments[tokenList[idx++]];
            const n = tokenList[idx++];
            const d = tokenList[idx++];
            this.model.splitSegmentByRatio2d(s, n / d);
        }

        // Origami folding
        else if (tokenList[idx] === 'r' || tokenList[idx] === 'rotate') {
            // Rotate around 'Seg' with 'Angle' all 'Points' with animation: r s1 angle p1 p2 p3...
            idx++;
            const s = this.model.segments[tokenList[idx++]];
            const angle = tokenList[idx++] * k;
            list = this.listPoints(tokenList, idx);
            idx += list.length;
            this.model.rotate(s, angle, list);
        } else if (tokenList[idx] === 'mop' || tokenList[idx] === 'moveOnPoint') {
            // Move all points on first
            idx++;
            let p0 = this.model.points[tokenList[idx++]];
            list = this.listPoints(tokenList, idx);
            idx += list.length;
            this.model.moveOnPoint(p0, list);
        } else if (tokenList[idx] === 'mos' || tokenList[idx] === 'moveOnSegment') {
            // Move point on the segment
            idx++;
            const p = this.model.points[tokenList[idx++]];
            const s = this.model.segments[tokenList[idx++]];
            this.model.moveOnSegment(s, p);
        } else if (tokenList[idx] === 'm' || tokenList[idx] === 'move') {
            // Move 1 point by dx,dy,dz in 3D with animation : move dx dy dz p1 p2 p3...
            idx++;
            const dx = tokenList[idx++] * k;
            const dy = tokenList[idx++] * k;
            const dz = tokenList[idx++] * k;
            list = this.listPoints(tokenList, idx);
            idx += list.length;
            this.model.movePoints(dx, dy, dz, list);
        } else if (tokenList[idx] === 'flat') {
            // Set z = 0 for p1 p2 p3...
            idx++;
            list = this.listPoints(tokenList, idx);
            this.model.flat(list);
            idx += list.length;
        } else if (tokenList[idx] === 'a' || tokenList[idx] === 'adjust') {
            // Adjust points in 3D to equal 2D length of segments : a p1 p2 p3...
            idx++;
            list = this.listPoints(tokenList, idx);
            idx += list.length;
            this.model.adjustList(list.length ===0 ? this.model.points : list);
        } else if (tokenList[idx] === 'check') {
            idx++;
            // Deselect all
            this.model.points.forEach(p => p.select = 0);
            this.model.segments.forEach(s => s.select = 0);
            this.model.checkSegments();
        } else if (tokenList[idx] === 'o' || tokenList[idx] === 'offset') {
            // Offset by dz a list of faces: o dz f1 f2...
            idx++;
            const dz = Number(tokenList[idx++]);
            list = this.listFaces(tokenList, idx);
            idx += list.length;
            this.model.offset(dz, list);
        }

        // Model turn, zoom and move
        else if (tokenList[idx] === 'turn') {
            // Turn the model around axis x,y,z by angle: turn 0 1 0 180
            idx++;
            const axis = new Segment(new Point(0, 0), new Point(0, 0, tokenList[idx++], tokenList[idx++], tokenList[idx++]));
            this.model.turn(axis, Number(tokenList[idx++]) * k);
        }
        // Turns
        else if (tokenList[idx] === 'tx') {
            // "tx: TurnX"
            idx++;
            const axis = new Segment(new Point(0, 0), new Point(0, 0, 1, 0, 0));
            this.model.turn(axis, Number(tokenList[idx++]) * k);
        } else if (tokenList[idx] === 'ty') {
            // "ty: TurnY"
            idx++;
            const axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 1, 0));
            this.model.turn(axis, Number(tokenList[idx++]) * k);
        } else if (tokenList[idx] === 'tz') {
            // "tz: TurnZ"
            idx++;
            const axis = new Segment(new Point(0, 0), new Point(0, 0, 0, 0, 1));
            this.model.turn(axis, Number(tokenList[idx++]) * k);
        } else if (tokenList[idx] === 'z' || tokenList[idx] === 'zoom') {
            // Zoom scale x y. The zoom is centered on x y z=0: z 2 50 50
            idx++;
            let scale = Number(tokenList[idx++]);
            const x = !isNaN(Number(tokenList[idx])) ? Number(tokenList[idx++]) : 0;
            const y = !isNaN(Number(tokenList[idx])) ? Number(tokenList[idx++]) : 0;
            // Animation
            const a = ((1 + this.tni * (scale - 1)) / (1 + this.tpi * (scale - 1)));
            const b = scale * (this.tni / a - this.tpi);
            this.model.movePoints(x * b, y * b, 0, this.model.points);
            this.model.scaleModel(a);
        } else if (tokenList[idx] === 'zf' || tokenList[idx] === 'fit') {
            // Zoom fit 3d: fit3d
            idx++;
            if (this.tpi === 0) {
                let bounds = this.model.get3DBounds();
                const w = 400;
                (this.za)[0] = w / Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
                (this.za)[1] = -(bounds.xMin + bounds.xMax) / 2;
                (this.za)[2] = -(bounds.yMin + bounds.yMax) / 2;
            }
            const a = ((1 + this.tni * ((this.za)[0] - 1)) / (1 + this.tpi * ((this.za)[0] - 1)));
            const b = (this.za)[0] * (this.tni / a - this.tpi);
            this.model.movePoints((this.za)[1] * b, (this.za)[2] * b, 0, this.model.points);
            this.model.scaleModel(a);
        }

        // Interpolator
        else if (tokenList[idx] === 'il') { // "il: Interpolator Linear"
            idx++;
            this.interpolator = Interpolator.LinearInterpolator;
        } else if (tokenList[idx] === 'ib') { // "ib: Interpolator Bounce"
            idx++;
            this.interpolator = Interpolator.BounceInterpolator;
        } else if (tokenList[idx] === 'io') { // "io: Interpolator OverShoot"
            idx++;
            this.interpolator = Interpolator.OvershootInterpolator;
        } else if (tokenList[idx] === 'ia') { // "ia: Interpolator Anticipate"
            idx++;
            this.interpolator = Interpolator.AnticipateInterpolator;
        } else if (tokenList[idx] === 'iao') { // "iao: Interpolator Anticipate OverShoot"
            idx++;
            this.interpolator = Interpolator.AnticipateOvershootInterpolator;
        } else if (tokenList[idx] === 'iad') { // "iad: Interpolator Accelerate Decelerate"
            idx++;
            this.interpolator = Interpolator.AccelerateDecelerateInterpolator;
        } else if (tokenList[idx] === 'iso') { // "iso Interpolator Spring Overshoot"
            idx++;
            this.interpolator = Interpolator.SpringOvershootInterpolator;
        } else if (tokenList[idx] === 'isb') { // "isb Interpolator Spring Bounce"
            idx++;
            this.interpolator = Interpolator.SpringBounceInterpolator;
        } else if (tokenList[idx] === 'igb') { // "igb: Interpolator Gravity Bounce"
            idx++;
            this.interpolator = Interpolator.GravityBounceInterpolator;
        }

        // Select
        else if (tokenList[idx] === 'selectPoints' || tokenList[idx] === 'sp') {
            idx++;
            list = this.listPoints(tokenList, idx);
            idx += list.length;
            this.model.points.forEach(function(p){
                p.select = (list.indexOf(p) !== -1) ? 1 : 0;
            });
        } else if (tokenList[idx] === 'selectSegments' || tokenList[idx] === 'ss') {
            idx++;
            list = this.listSegments(tokenList, idx);
            idx += list.length;
            this.model.segments.forEach(function(s){
                s.select = (list.indexOf(s) !== -1) ? 1 : 0;
            });
        } else if (tokenList[idx] === 'labels') {
            idx++;
            this.model.labels = !this.model.labels;
        } else if (tokenList[idx] === 'textures') {
            idx++;
            this.model.textures = !this.model.textures;
        } else if (tokenList[idx] === 'overlay') {
            idx++;
            this.model.overlay = !this.model.overlay;
        } else if (tokenList[idx] === 'lines') {
            idx++;
            this.model.lines = !this.model.lines;
        }

        // End of command
        else if (tokenList[idx] === 'eoc') {
            idx++;
        }

        // Unexpected end
        else {
            console.log('Syntax error', tokenList[idx-2], tokenList[idx-1], tokenList[idx], tokenList[idx+1], tokenList[idx+2])
            idx = tokenList.length + 1;
            throw new Error("Syntax error!", idx);
        }

        // Keep state after executing
        this.pushUndo();
        this.iToken = idx;
    }

    // Make a list from the following points numbers @testOK
    listPoints(tokenList, iStart) {
        const list = [];
        while (Number.isInteger(Number(tokenList[iStart]))) {
            list.push(this.model.points[tokenList[iStart++]]);
        }
        return list;
    }

    // Make a list from the following segments numbers @testOK
    listSegments(tokenList, iStart) {
        const list = [];
        while (Number.isInteger(Number(tokenList[iStart]))) {
            list.push(this.model.segments[tokenList[iStart++]]);
        }
        return list;
    }

    // Make a list from the following faces numbers @testOK
    listFaces(tokenList, iStart) {
        const list = [];
        while (Number.isInteger(Number(tokenList[iStart]))) {
            list.push(this.model.faces[tokenList[iStart++]]);
        }
        return list;
    }

    pushUndo() {
        this.done.push(this.model.serialize());
    }

    popUndo() {
        if (this.done.length === 0) {
            return;
        }
        // Previous is restored if any
        Object.assign(this.model, this.model.deserialize(this.done.pop()));
    }
}
// 447 lines
