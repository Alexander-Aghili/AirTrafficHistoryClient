import '../style.css';
import image from '../airplane_image.png';
import {RequestSettings, AreaBounds, makeRequest} from "./request.js";
import {getAircraftDataAtTimestamp, getAircraftListFromData, getNextAircraftData, INTERPOLATION_SECOND_INTERVAL} from "./decode.js";

//----------------------------------------------------------------------------------------
const getCenterCoordinates = function(areaBounds) {
  return [
    ( (areaBounds.getLamin + areaBounds.getLamax) / 2),
    ( (areaBounds.getLomin + areaBounds.getLomax) / 2)
  ];
}

//Defintely doesn't work
const createBoundingBoxLayer = function(areaBounds) {
  let points = [
    getProjectionFromLatLonCoordinates([areaBounds.getLamin, areaBounds.getLomin]),
    getProjectionFromLatLonCoordinates([areaBounds.getLamin, areaBounds.getLomax]),
    getProjectionFromLatLonCoordinates([areaBounds.getLamax, areaBounds.getLomin]),
    getProjectionFromLatLonCoordinates([areaBounds.getLamax, areaBounds.getLomax]),
  ];

  let square = new ol.geom.MultiPoint(points);
  let squareFeature = new ol.Feature(square);

  return new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [squareFeature]
    }),
  });

}

//----------------------------------------------------------------------------------------

const ZOOM_LEVEL = 9;
const VECTOR_LAYER_LEVEL = 2;

const TIMELAPSE_SPEED = 55;//This shall be included below
//This function shall get destroyed and replaced with input data from form on different html page
const createRequestSettings = function() {
  //const areaBounds = new AreaBounds(30,41,-125,-115);
  const areaBounds = new AreaBounds(38.93,40.59,-106.09,-102.86);
  
  const firstTimestamp = 1664409290;
  const lastTimestamp = firstTimestamp+(100*5);
  const includeGroundTargets = false; //Makes this toggle not request settings

  return new RequestSettings(areaBounds, firstTimestamp, lastTimestamp, includeGroundTargets);
}

let requestSettings = createRequestSettings();
const midPoint = getCenterCoordinates(requestSettings.getAreaBounds);

//Transformation of projection is required to get lat/lon coordinates to work. 
const getProjectionFromLatLonCoordinates = function(coordinates) {
  return  ol.proj.transform(coordinates, 'EPSG:4326', 'EPSG:3857');
}

const buildMap = function() {
  return new ol.Map({
    target: 'map',
    view: new ol.View({
      center: getProjectionFromLatLonCoordinates(midPoint),
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

const mapLayer = new ol.layer.Tile({
    source: new ol.source.OSM()
});

const boxLayer = createBoundingBoxLayer(requestSettings.getAreaBounds);

let layerStack = [mapLayer, boxLayer];

const getAircraftListFromApiCall = async function(requestSettings) {
    return await getAircraftListFromData(makeRequest(requestSettings));
}
  
const reRenderMapLayers = function () {
    map.setLayerGroup(new ol.layer.Group({
      layers: layerStack,
    }));
    map.render();
}
reRenderMapLayers();

map.on('moveend', reRenderMapLayers);

//This probably shouldn't be named the same as the parameter to startRunning function
let listOfAircraft = await getAircraftListFromApiCall(requestSettings);

const delay = ms => new Promise(res => setTimeout(res, ms));

//--------------------------------------------------------------------------------------------------------------
//Experimental

const getIconStyle = function(srcFile, aircraftData) {
  return new ol.style.Style({
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
      offsetX: -20,
      offsetY: 20
    }),
  });
}

const getFeature = function(aircraftData) {
  const style = getIconStyle(image, aircraftData);
  const feature = new ol.Feature({
    geometry: new ol.geom.Point(getProjectionFromLatLonCoordinates(aircraftData.getCoordinates)),
  });
  feature.setStyle(style);
  return feature;
}


const getVector = function(featureList) {
  return new ol.layer.Vector({
    source: new ol.source.Vector({
      features: featureList,
    }),
  });
}

const generateTimelapseWithoutInterpolation = function(listOfAircraft, requestSettings) {
  let vectorList = [];
  let g = 0;
  // -4 Because last timestamp is interval of 5 but backend doesn't include that time so there is 4 seconds of no data
  for (let i = requestSettings.getFirstTimestamp; i < requestSettings.getLastTimestamp; i++) {
    let featureList = [];
    let k = 0;
    if (i % 5 == 0) {
      for (let j = 0; j < listOfAircraft.length; j++) {
        try {
          let aircraftData = getNextAircraftData(listOfAircraft[j], i);
          if (aircraftData != null) {
            if (!requestSettings.getIncludeGroundTargets && aircraftData.getOnGround){} else {
              featureList[k++] = getFeature(aircraftData);
            }
          } 
        } catch (error)  {
        }
      }
      vectorList[g++] = getVector(featureList);
    } else {
      if (g>1){
        vectorList[g] = vectorList[g-1];
        g++;
      }
    }
  }
  return vectorList;
}


const generateTimelapse = function(listOfAircraft, requestSettings) {
  let vectorList = [];
  let g = 0;
  // -4 Because last timestamp is interval of 5 but backend doesn't include that time so there is 4 seconds of no data
  for (let i = requestSettings.getFirstTimestamp; i < requestSettings.getLastTimestamp-4; i+=INTERPOLATION_SECOND_INTERVAL) {
    let featureList = [];
    let k = 0;
    for (let j = 0; j < listOfAircraft.length; j++) {
      try {
        let aircraftData = getNextAircraftData(listOfAircraft[j], i);
        if (aircraftData != null && aircraftData != []) {
          if (!requestSettings.getIncludeGroundTargets && aircraftData.getOnGround){} else {
            featureList[k++] = getFeature(aircraftData);
          }
        } 
      } catch (error)  {
      }
    }
    vectorList[g++] = getVector(featureList);
  }
  return vectorList;
}

let isStart = false;

const startTimelapse = async function(vectorList) {
  isStart = true;

  console.log("Begin Timelapse");
  for (let i = 0; i < vectorList.length; i++) {
    layerStack[VECTOR_LAYER_LEVEL] = vectorList[i];
    reRenderMapLayers();
    await delay(1000 * (INTERPOLATION_SECOND_INTERVAL/TIMELAPSE_SPEED));
    //await delay(1000 * (1/TIMELAPSE_SPEED));

  }
  console.log("End Timelapse");

  isStart=false;
}

await delay(1000);

const vectorList = generateTimelapse(listOfAircraft, requestSettings);
await startTimelapse(vectorList);

window.onclick = async function(event) {
  if (isStart) return;
  await startTimelapse(vectorList);
}