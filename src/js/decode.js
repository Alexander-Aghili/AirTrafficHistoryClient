export const INTERPOLATION_SECOND_INTERVAL = .25;

export class Aircraft {
    constructor(data) {
        this.icao24 = data['icao24'];
        this.aircraftDataList = createListOfAircraftData(data['aircraftData']);
        this.dataIterator = 0;
    }

    get getIcao24() {return this.icao24;}
    get getAircraftDataList() {return this.aircraftDataList;}
    get getDataIterator() { return this.dataIterator; }

    incrementDataIterator() { this.dataIterator++; }
}

//TODO implement
const calculateHeadingInterpolation = function(initHeading, nextHeading, percentageOfTurn) {
     
}

const calculateCoordinateOnLineSegment = function(firstCoordinate, secondCoordinate, distanceDown) {    
    return [
        (firstCoordinate[0] + ((secondCoordinate[0]-firstCoordinate[0]) * distanceDown)),
        (firstCoordinate[1] + ((secondCoordinate[1]-firstCoordinate[1]) * distanceDown))
    ]
}


//This might be one of the worst functions I have ever created
const createListOfAircraftData = function(jsonArrayAircraftData) {
    let tempAircraftDataList = []
    let k = 0;
    

    for (var i = 0; i < jsonArrayAircraftData.length; i++) {
        let aircraftData = new AircraftData(jsonArrayAircraftData[i]);
//        tempAircraftDataList[k++] = aircraftData;

        const originalK = k-1;
        if (i > 0 && !aircraftData.getOnGround && aircraftData.getTimestamp > tempAircraftDataList[k-1].getTimestamp + 5) {
            const intervalDifference = (aircraftData.getTimestamp - tempAircraftDataList[k-1].getTimestamp)/5;
            
            for (let j = 0; j < intervalDifference-1; j++) {
                tempAircraftDataList[k] = new AircraftData(jsonArrayAircraftData[i]);
                tempAircraftDataList[k].setNewTimestamp(tempAircraftDataList[k-1].getTimestamp + 5);
                tempAircraftDataList[k].setNewCoordinates(calculateCoordinateOnLineSegment(tempAircraftDataList[originalK].getCoordinates, aircraftData.getCoordinates, ((j+1)/intervalDifference)));
                k++; 
            }
        }
        
        tempAircraftDataList[k++] = aircraftData;
    }

    tempAircraftDataList = interpolateAllAircraftData(tempAircraftDataList);
    try {
        if (tempAircraftDataList != null && tempAircraftDataList[0].getCallsign == "N9621V"){
            console.log(jsonArrayAircraftData);
            console.log(tempAircraftDataList);
        }
    } catch (error) {}

    return tempAircraftDataList;
}

const interpolateAllAircraftData = function(aircraftDataList) {
    let tempAircraftDataList = [];
    let k = 0;
    for (var i = 0; i < aircraftDataList.length-1; i++) {
        tempAircraftDataList[k++] = aircraftDataList[i]; 
        for (var j = 0; j < (5*(1/INTERPOLATION_SECOND_INTERVAL))-1; j++) {
            tempAircraftDataList[k] = AircraftData.fromAircraftData(aircraftDataList[i]);
            tempAircraftDataList[k].setNewTimestamp(tempAircraftDataList[k-1].getTimestamp + INTERPOLATION_SECOND_INTERVAL);
            tempAircraftDataList[k].setNewCoordinates(
                calculateCoordinateOnLineSegment(
                    aircraftDataList[i].getCoordinates, 
                    aircraftDataList[i+1].getCoordinates, 
                    ((j+1)/(5*(1/INTERPOLATION_SECOND_INTERVAL)))
                )
            );
            k++; 
        
        }
    }
    return tempAircraftDataList;
}

export function getAircraftDataAtTimestamp(aircraftDataList, timestamp) {
    //o(n) 100% 
    //Could be improved to o(nlgn) or even o(1) please check data to see possiblities
    for (let i = 0; i < aircraftDataList.length; i++) {
        if (aircraftDataList[i].getTimestamp === timestamp) {
            return aircraftDataList[i];
        }
    }
    return null;
}

export function getNextAircraftData(aircraft, timestamp) {
    if (timestamp == aircraft.getAircraftDataList[aircraft.getDataIterator].getTimestamp) {
        let aircraftData = aircraft.getAircraftDataList[aircraft.dataIterator];
        aircraft.incrementDataIterator();
        return aircraftData;
    } else {
        return null;
        return aircraft.getAircraftDataList[aircraft.dataIterator];
    }
}


export class AircraftData {
    constructor(data) {
        this.timestamp      = data[0];
        this.callsign       = data[1];
        this.latitude       = data[2];
        this.longitude      = data[3];
        this.baroAltitude   = data[4];
        this.onGround       = data[5];
        this.velocity       = data[6];
        this.trueTrack      = data[7];
        this.verticalRate   = data[8];
        this.geoAltitude    = data[9];
    }

    static fromAircraftData(aircraftData) {
        return new AircraftData(
            [
                aircraftData.timestamp,
                aircraftData.callsign,
                aircraftData.latitude,
                aircraftData.longitude,
                aircraftData.baroAltitude,
                aircraftData.onGround,
                aircraftData.velocity,
                aircraftData.trueTrack,
                aircraftData.verticalRate,
                aircraftData.geoAltitude,
            ]
        );
    }
    
    get getCoordinates() { return [this.latitude, this.longitude]; }
    get getTrueTrack() { return this.trueTrack; }
    get getTimestamp() { return this.timestamp; }
    get getOnGround() { return this.onGround; }
    get getCallsign() { return this.callsign; }
    get getVelocity() { return this.velocity; }

    get getAircraftData() { return this; }


    setNewCoordinates(coordinates) { 
        // if (this.timestamp == 1663205715 && this.callsign == "SCX8954") {
        //     console.log(coordinates);
        // }

        this.latitude = coordinates[0];
        this.longitude = coordinates[1];
    }

    setNewTimestamp(timestamp) {
        this.timestamp = timestamp;
    }
}

export async function getAircraftListFromData(promise) {
    let aircraftArray = [];
    await promise.then(function(data) {
        for (let i = 0; i < data.length; i++) {
            aircraftArray[i] = new Aircraft(data[i]);
        }
    });
    return aircraftArray;
}

