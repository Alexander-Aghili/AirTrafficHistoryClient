export class AreaBounds {
    constructor(lomin, lomax, lamin, lamax) {
        this.lomin = lomin;
        this.lomax = lomax;
        this.lamin = lamin;
        this.lamax = lamax;
    }

    get getLomin() { return this.lomin; }
    get getLomax() { return this.lomax; }
    get getLamin() { return this.lamin; }
    get getLamax() { return this.lamax; }

    set setLomin(lomin) { this.lomin = lomin; }
    set setLomax(lomax) { this.lomax = lomax; }
    set setLamin(lamin) { this.lamin = lamin; }
    set setLamax(lamax) { this.lamax = lamax; }

    get url() { return this.toUrl(); }

    toUrl() {
        return this.lomin + "/" + this.lomax + "/" + this.lamin + "/" + this.lamax + "/";
    }
}

//Work on this later to make shit easier
export class RequestSettings {
    constructor(areaBounds, firstTimestamp, lastTimestamp, includeGroundTargets) {
        this.areaBounds = areaBounds;
        this.firstTimestamp = firstTimestamp;
        this.lastTimestamp = lastTimestamp;
        this.includeGroundTargets = includeGroundTargets;
    }

    get getAreaBounds() { return this.areaBounds; }
    get getFirstTimestamp() { return this.firstTimestamp; }
    get getLastTimestamp() { return this.lastTimestamp; }
    get getIncludeGroundTargets() { return this.includeGroundTargets; }


    get getUrl() { return this.areaBounds.url + this.firstTimestamp + "/" + this.lastTimestamp}
}

const BASE_URL = "http://localhost:8081/AirTrafficHistory/history/getTrafficHistory/";

export function makeRequest(requestSettings) {
    let url = BASE_URL + requestSettings.getUrl;
    console.log(url);
    return axios.get(url).then(response => response.data);
}