const ST_STONE_VIOLET = 1;
const ST_STONE_RED = 2;
const ST_STONE_INDIGO = 3;
const ST_STONE_ORANGE = 4;
const ST_ENERGY = 5;
const ST_ROAD = 6;
const ST_ROAD_SLEEP = 7;
const ST_ROAD_AWAKE = 8;

const CONTENT_SPRITES = {
    [ST_STONE_VIOLET]: TT.stoneV,
    [ST_STONE_RED]: TT.stoneR,
    [ST_STONE_INDIGO]: TT.stoneI,
    [ST_STONE_ORANGE]: TT.stoneO,
    [ST_ENERGY]: TT.energy,
}
const SEMICONDUCTOR_SPRITES = {
    [ST_ROAD_SLEEP]: TT.roadSleep,
    [ST_ROAD_AWAKE]: TT.roadAwakening,
}

const STONE_TYPE_TO_ROAD_COLOR = {
    [ST_STONE_VIOLET]: COLOR_VIOLET_ROAD,
    [ST_STONE_RED]: COLOR_RED_ROAD,
    [ST_STONE_INDIGO]: COLOR_INDIGO_ROAD,
    [ST_STONE_ORANGE]: COLOR_ORANGE_ROAD,
}

class Scheme {

    static SIZE_RADIUS = 800000000;

    static schemes = {};

    static getNamedScheme(name) {
        if (!Scheme.schemes[name]) {
            Scheme.schemes[name] = new Scheme();
        }
        return Scheme.schemes[name];
    }

    scheme = {};

    get ratio() {
        return Scene.deviceRation;
    }

    coloringSpeedMs = 200;

    visibleUpdate = () => {};
    injectVisibleUpdate(visibleCallback) {
        this.visibleUpdate = visibleCallback;
    }

    changeCellProperty(property, val, x, y) {
        if (val) {
            if (!this.scheme[x]) { this.scheme[x] = {}; }
            if (!this.scheme[x][y]) { this.scheme[x][y] = { [property]: val } }
            else { this.scheme[x][y][property] = val; }
        }
        else {
            if (this.scheme[x] && this.scheme[x][y]) {
                this.scheme[x][y][property] = null;
                this.isCellEmpty(x, y);
            }
        }
    }
    changeCellContent(type, x, y) { this.changeCellProperty('content', type, x, y); }
    changeCellRoad(obj, x, y) { this.changeCellProperty('road', obj, x, y); }
    changeCellSemiconductor(obj, x, y) { this.changeCellProperty('semiconductor', obj, x, y); }

    findCellOrEmpty(x, y) {
        if (this.scheme[x] && this.scheme[x][y]) { return this.scheme[x][y]; }
        return {};
    }
    findRoadCellOrEmpty(x, y) {
        let cell = this.findCellOrEmpty(x, y);
        if (!cell.road) { cell.road = {}; }
        return cell
    }
    findSemiconductorCellOrEmpty(x, y) {
        let cell = this.findCellOrEmpty(x, y);
        if (!cell.semiconductor) { cell.semiconductor = {}; }
        return cell
    }

    isCellEmpty (x, y) {
        if (!this.scheme[x] || !this.scheme[x][y]) {
            return true;
        }
        for (const property in this.scheme[x][y]) {
            if (this.scheme[x][y][property]) { return false; }
        }
        this.scheme[x][y] = null;
        return true;
    }

    getRelativeCellPositionBySize(x, y, side) {
        if (UP == side) { return [x, y - 1]; }
        if (RIGHT == side) { return [x + 1, y]; }
        if (DOWN == side) { return [x, y + 1]; }
        if (LEFT == side) { return [x - 1, y]; }
    }

    isEmptyUpDown(x, y) { return this.isCellEmpty(x, y + 1) && this.isCellEmpty(x, y - 1); }
    isEmptyLeftRight(x, y) { return this.isCellEmpty(x + 1, y) && this.isCellEmpty(x - 1, y); }

    /** ROADs **/

    resetPathsOnRoad(x, y) {
        let road = this.findCellOrEmpty(x, y).road;
        if (!road) { return; }

        let countAround = this.countObjectsAround(x, y);
        let emptyAround = !countAround;
        let emptyPaths = !road.paths[ROAD_PATH_UP] && !road.paths[ROAD_PATH_RIGHT] && !road.paths[ROAD_PATH_DOWN] && !road.paths[ROAD_PATH_LEFT];

        if (ROAD_HEAVY == road.type && countAround < 3) { road.type = ROAD_LIGHT; }

        if (emptyAround && !emptyPaths) { return; }

        if (emptyAround || this.isEmptyUpDown(x, y) ||
            (ROAD_HEAVY != road.type && countAround == 3 && (this.isCellEmpty(x, y + 1) || this.isCellEmpty(x, y - 1)))
        ) {
            this.defineRoadPath(x, y, ROAD_PATH_LEFT, true)
            this.defineRoadPath(x, y, ROAD_PATH_RIGHT, true)
            this.defineRoadPath(x, y, ROAD_PATH_UP, false)
            this.defineRoadPath(x, y, ROAD_PATH_DOWN, false)
        }
        else if (this.isEmptyLeftRight(x, y) || (ROAD_HEAVY != road.type && countAround == 3)) {
            this.defineRoadPath(x, y, ROAD_PATH_LEFT, false)
            this.defineRoadPath(x, y, ROAD_PATH_RIGHT, false)
            this.defineRoadPath(x, y, ROAD_PATH_UP, true)
            this.defineRoadPath(x, y, ROAD_PATH_DOWN, true)
        }
        else {
            this.defineRoadPath(x, y, ROAD_PATH_UP, !this.isCellEmpty(x, y - 1));
            this.defineRoadPath(x, y, ROAD_PATH_RIGHT, !this.isCellEmpty(x + 1, y));
            this.defineRoadPath(x, y, ROAD_PATH_DOWN, !this.isCellEmpty(x, y + 1));
            this.defineRoadPath(x, y, ROAD_PATH_LEFT, !this.isCellEmpty(x - 1, y));
        }

        this.defineRoadPath(x, y, ROAD_PATH_HEAVY, ROAD_HEAVY == road.type);
    }

    resetPathsOnNeighborsRoads(x, y) {
        this.resetPathsOnRoad(x, y - 1);
        this.resetPathsOnRoad(x + 1, y);
        this.resetPathsOnRoad(x, y + 1);
        this.resetPathsOnRoad(x - 1, y);
    }

    defineRoadPath(x, y, pathType, pathContent) {
        this.findCellOrEmpty(x, y).road.paths[pathType] = pathContent;
    }

    setColorToRoad(color, fromDir, x, y) {
        let road = this.findCellOrEmpty(x, y).road;
        if (!road) { return; }
        let pathType = SIDE_TO_ROAD_PATH[fromDir];

        if (color) {
            if (this.canPathSetColor(road, pathType)) {
                road.paths[pathType] = color;
                this.moveColorToNextPaths(
                    x, y,
                    color,
                    this.disabledDirsToMoveColor(road, this.countRoadsAround(x, y), fromDir)
                );
            }
        }
        else {
            if (road.paths[pathType]) {
                road.paths[pathType] = true;
            }
        }

        this.visibleUpdate(x, y);
    }

    canPathSetColor(road, pathType) { return true === road.paths[pathType]; }

    moveColorToNextPaths(x, y, color, disabledDirs) {
        let road = this.findCellOrEmpty(x, y).road;
        if (!road) { return; }

        setTimeout(() => {
            let nextSides = [];

            SIDES.map((side) => {
                if (disabledDirs.includes(side)) { return; }
                let pathType = SIDE_TO_ROAD_PATH[side];
                if (this.canPathSetColor(road, pathType)) {
                    road.paths[pathType] = color;
                    nextSides.push(side);
                }
            });
            this.visibleUpdate(x, y);

            setTimeout(() => {
                if (this.canPathSetColor(road, ROAD_PATH_HEAVY)) {
                    road.paths[ROAD_PATH_HEAVY] = color;
                    this.visibleUpdate(x, y);
                }
            }, this.coloringSpeedMs * 0.5);

            this.moveColorToNextCells(x, y, nextSides, color);

        }, this.coloringSpeedMs);
    }

    moveColorToNextCells(x, y, nextSides, color) {
        setTimeout(() => {
            nextSides.map((toDir) => {
                this.setColorToRoad(color, OPPOSITE_SIDE[toDir], ...this.getRelativeCellPositionBySize(x, y, toDir))
            });
        }, this.coloringSpeedMs)
    }

    disabledDirsToMoveColor(road, countRoadsAround, fromDir) {
        let disabled = [fromDir];
        if (ROAD_HEAVY != road.type && countRoadsAround > 2) {
            if (fromDir == LEFT || fromDir == RIGHT) {
                disabled.push(UP);
                disabled.push(DOWN);
            }
            else {
                disabled.push(LEFT);
                disabled.push(RIGHT);
            }
        }
        return disabled;
    }

    countObjectsAround(x, y) {
        let count = 0;
        if (!this.isCellEmpty(x + 1, y)) { count++; }
        if (!this.isCellEmpty(x - 1, y)) { count++; }
        if (!this.isCellEmpty(x, y + 1)) { count++; }
        if (!this.isCellEmpty(x, y - 1)) { count++; }
        return count;
    }

    isRoadsAround(x, y) { return !!this.countRoadsAround(x, y); }
    countRoadsAround(x, y) {
        let count = 0;
        if (this.findCellOrEmpty(x + 1, y).road) { count++; }
        if (this.findCellOrEmpty(x - 1, y).road) { count++; }
        if (this.findCellOrEmpty(x, y + 1).road) { count++; }
        if (this.findCellOrEmpty(x, y - 1).road) { count++; }
        return count;
    }

    isRoadLeftOrRight(x, y) { return this.findCellOrEmpty(x + 1, y).road || this.findCellOrEmpty(x - 1, y).road; }

    /** SEMICONDUCTOR **/

    putSemiconductor(scType, x, y) {
        if (!scType) {
            this.changeCellSemiconductor(null, x, y);
        }
        else if (ST_ROAD_SLEEP == scType) {
            return this.putSleepSemiconductor(x, y);
        }
        return false;
    }

    putSleepSemiconductor(x, y) {
        if (this.isSemiconductorTypeAround(ST_ROAD_SLEEP, x, y) ||
            1 < this.countSemiconductorTypeAround(ST_ROAD_AWAKE, x, y))
        {
            return false;
        }

        let direction;
        if (this.isSemiconductorTypeAround(ST_ROAD_AWAKE, x, y)) {
            if (this.isSemiconductorTypeLeftOrRight(ST_ROAD_AWAKE, x, y)) {
                direction = ROAD_LEFT_RIGHT;
            }
            else { direction = ROAD_UP_DOWN; }
        }
        else {
            if (ST_ROAD_SLEEP == this.findSemiconductorCellOrEmpty(x, y).semiconductor.type) {
                direction = (ROAD_LEFT_RIGHT == this.findSemiconductorCellOrEmpty(x, y).semiconductor.direction ? ROAD_UP_DOWN : ROAD_LEFT_RIGHT);
            }
            else {
                if (!this.isRoadsAround(x, y) || this.isRoadLeftOrRight(x, y)) {
                    direction = ROAD_LEFT_RIGHT;
                }
                else { direction = ROAD_UP_DOWN; }
            }
        }
        this.changeCellSemiconductor({ type: ST_ROAD_SLEEP, direction: direction }, x, y);
        return true;
    }

    isSemiconductorTypeAround(scType, x, y) { return !!this.countSemiconductorTypeAround(scType, x, y); }
    countSemiconductorTypeAround(scType, x, y) {
        let count = 0;
        if (scType == this.findSemiconductorCellOrEmpty(x + 1, y).semiconductor.type) { count++; }
        if (scType == this.findSemiconductorCellOrEmpty(x - 1, y).semiconductor.type) { count++; }
        if (scType == this.findSemiconductorCellOrEmpty(x, y + 1).semiconductor.type) { count++; }
        if (scType == this.findSemiconductorCellOrEmpty(x, y - 1).semiconductor.type) { count++; }
        return count;
    }

    isSemiconductorTypeLeftOrRight(scType, x, y) { return scType == this.findSemiconductorCellOrEmpty(x + 1, y).semiconductor.type || scType == this.findSemiconductorCellOrEmpty(x - 1, y).semiconductor.type; }
}
