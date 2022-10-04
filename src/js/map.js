import '../style.css';
import image from '../airplane_image.png';
import {RequestSettings, AreaBounds, makeRequest} from "./request.js";
import {getAircraftDataAtTimestamp, getAircraftListFromData, getNextAircraftData} from "./decode.js";

const ZOOM_LEVEL = 4;
const TEST_COORDINATES = [-100, 37.5]
let test = false;

const TIMELAPSE_SPEED = 20;//This shall be included below
//This function shall get destroyed and replaced with input data from form on different html page
const createRequestSettings = function() {
  //const areaBounds = new AreaBounds(35,41,-125,-120);
  const areaBounds = new AreaBounds(38.93,40.59,-106.09,-103.86);
  const firstTimestamp = 1663205684;
  const lastTimestamp = firstTimestamp+(100*5); //635
  const includeGroundTargets = false; //Makes this toggle not request settings

  return new RequestSettings(areaBounds, firstTimestamp, lastTimestamp, includeGroundTargets);
}

let requestSettings = createRequestSettings();

//Transformation of projection is required to get lat/lon coordinates to work. 
const getProjectionFromLatLonCoordinates = function(coordinates) {
  return  ol.proj.transform(coordinates, 'EPSG:4326', 'EPSG:3857');
}

const buildMap = function() {
  return new ol.Map({
    target: 'map',
    view: new ol.View({
      center: getProjectionFromLatLonCoordinates(TEST_COORDINATES),
      zoom: ZOOM_LEVEL,
    }),
    controls: ol.control.defaults({
      attributionOptions: {
        collapsible: false
      }
    }),
  });  
}

let map = buildMap();

const getMapZoomLevel = function() {
  return map.getView().getZoom();
}

//Not sure how well this function works
const getScaleBasedOnZoom = function() {
  /*const slideBase = .02;
  return Math.pow(getMapZoomLevel(), slideBase)-1;*/

  const h = 5;
  const k = 10;
  const b = .5;
  const a = 3;
  const x = getMapZoomLevel();
  return (a*Math.atan(b*(x-k)))+h;
}

//Doesn't need to be 450-heading because 0 radians is a 360 heading since the icon default is facing up
const convertHeadingToRadians = function(heading) {
  return (Math.PI/180) * (heading); 
}

const iconVectorLayer = function(srcFile, aircraftData) {
  //Must be done in this order due to cache
  //https://gis.stackexchange.com/questions/157212/how-to-set-the-url-from-an-icon-in-openlayers-3
  
  const iconStyle = new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 46],
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      scale: getScaleBasedOnZoom()*.015,
      src: srcFile,
      rotation: convertHeadingToRadians(aircraftData.getTrueTrack),
    }),
    text: new ol.style.Text({
      text: aircraftData.getCallsign,
      fill: new ol.style.Fill({color: 'black'}),
      stroke: new ol.style.Stroke({color: 'yellow', width: 1}),
      offsetX: -20,
      offsetY: 20
    }),
  });

  const iconFeature = new ol.Feature({
    geometry: new ol.geom.Point(getProjectionFromLatLonCoordinates(aircraftData.getCoordinates)),
  });

  iconFeature.setStyle(iconStyle);

  return new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [iconFeature],
    }),
  });
}

const mapLayer = new ol.layer.Tile({
  source: new ol.source.OSM()
});

let layerStack = [mapLayer];

const getAircraftListFromApiCall = async function(requestSettings) {
  return await getAircraftListFromData(makeRequest(requestSettings));
}

//Doesn't rerender layers immedietaly after, must be done manually using reRenderMapLayers function. 
const addLayerStackToList = function(aircraftDataArray, includeGroundTargets) {
    if (includeGroundTargets) {
      addLayerStackToListWithGroundTargets(aircraftDataArray);
    } else {
      addLayerStackToListWithoutGroundTarget(aircraftDataArray);
    }
}

//Needs to update such that additional layers are not interfered with.  
const addLayerStackToListWithGroundTargets = function(aircraftDataArray) {
  for (var i = 0; i < aircraftDataArray.length; i++) {
    layerStack[i+1] = iconVectorLayer(image, aircraftDataArray[i]);
  }
}

//Needs to update such that additional layers are not interfered with.  
const addLayerStackToListWithoutGroundTarget = function(aircraftDataArray) {
  let k = 1; //Prevents errors since some layerStack won't have all aircraft
  
  //Might be important to remove planes stuck on the edge but removes all planes after last timestamp
  //layerStack = [mapLayer]; 
  
  for (var i = 0; i < aircraftDataArray.length; i++) {
    if (aircraftDataArray[i] != null && !aircraftDataArray[i].getOnGround) {
      layerStack[k] = iconVectorLayer(image, aircraftDataArray[i]);
      k++;
    }
  }
}



const reRenderMapLayers = function () {
  map.setLayerGroup(new ol.layer.Group({
    layers: layerStack,
  }));
}
reRenderMapLayers();

map.on('moveend', reRenderMapLayers);

//This probably shouldn't be named the same as the parameter to startRunning function
let listOfAircraft = await getAircraftListFromApiCall(requestSettings);

//Im pretty sure this doesn't work
const filterAircraft = function(listOfAircraft, filterConstant) {
  let newListOfAircraft = [];
  let k = 0;
  for (var i = 0; i < listOfAircraft.length; i++) {
    let aircraftDataList = listOfAircraft[i].getAircraftDataList;
    let goodData = true;
    for (var j = 0; j < aircraftDataList.length-1; j++) {
      if (aircraftDataList[j].getTimestamp-aircraftDataList[j+1].getTimestamp > filterConstant) {
        goodData = false;
        break;
      }
    }

    if (goodData) {
      newListOfAircraft[k++] = listOfAircraft[i];
    }
  }
  return newListOfAircraft;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

//Also ensure that you fix all the aircraft on the side getting fucked up
const startRunning = async function(listOfAircraft, requestSettings) {
  let aircraftDataArray = []
  console.log("Begin Scenerio")
  for (let i = requestSettings.getFirstTimestamp; i < requestSettings.getLastTimestamp; i++) {
    for (let j = 0; j < listOfAircraft.length; j++) {
      try {
        //aircraftDataArray[j] = getAircraftDataAtTimestamp(listOfAircraft[j].getAircraftDataList, i).getAircraftData;
        let aircraftData = getNextAircraftData(listOfAircraft[j], i);
        if (aircraftData != null)
          aircraftDataArray[j] = aircraftData;
      } catch (error)  {
        aircraftDataArray[j] = null;
      }
    }
    addLayerStackToList(aircraftDataArray, requestSettings.getIncludeGroundTargets);
    reRenderMapLayers();
    await delay(1000 * (1/TIMELAPSE_SPEED));

    if (i%5==0) {
      console.log(i);
      while(!test) {
        await delay(500);
      }
    }
    test = false;
  }
 
  console.log("End Scenerio");
}

document.onclick = function(event) {
  test = true;
}

await startRunning(listOfAircraft, requestSettings);
