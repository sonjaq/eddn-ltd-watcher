const zlib = require('zlib');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const moment = require('moment');

moment.relativeTimeThreshold('ss', 1);
console.log('beginning SQL.media LTD price detector');
sock.connect('tcp://eddn.edcd.io:9500');
console.log('Worker connected to EDDN Firehose');

sock.subscribe('');
let screenContent = { lastMessage: undefined, counters: undefined, maxLocation: undefined, lastLocation: undefined, topLocations: undefined };
let maxLocation = { "system": "SQL", "station": ".media", "sellPrice": 0, "timestamp": new Date()};
let maxes = [];
let counters = { req: 0, commoditiesReq: 0, lastReqTime: undefined, ltdCount:0 };
updateMaxLocation(maxLocation);
sock.on('message', topic => {
  let theCounters = getCounters();
  theCounters.req++;
  let content = JSON.parse(zlib.inflateSync(topic));
  theCounters.lastReqTime = moment(content.message.timestamp).fromNow(true);
  if ( content['$schemaRef'] === 'https://eddn.edcd.io/schemas/commodity/3' ) { 
    theCounters.commoditiesReq++;
    let commodities = content.message.commodities;	
    let system = content.message.systemName;
    let station = content.message.stationName;
    let msg = system + " " + station;
    commodities.forEach( item  => { 
      
      if ( item.name == "lowtemperaturediamond" ) { 
        getCounters().ltdCount++;
	      let thisItem = { 
						system: system,
						station: station, 
            sellPrice: item.sellPrice, 
            timestamp: new Date(content.message.timestamp), 
						humanTime: moment(this.timestamp).fromNow() };
	      let maxLoc = getMaxLocation();
        if ( thisItem.sellPrice > maxLoc.sellPrice ) {
          msg = "NEW MAX PRICE!!!!\n" + msg;
          updateMaxLocation(thisItem);
        } else {
	        updateMaxLocations( thisItem );
        }
	
				screenContent.lastLocation = thisItem;
	      screenContent.maxLocation = getMaxLocation();
				screenContent.topLocations = getMaxes();
      } else { 
	       getCounters().otherCount++;
      }
    }); 
		screenContent.lastMessage = msg;
  } 
 drawScreen();
});


let lastFrame = Date.now();
const frameThrottle = 17; // 17ms is just under 60fps
function drawScreen() {
	frameTime = Date.now() - lastFrame;
	if ( frameTime < frameThrottle ) return;
	lastFrame = frameTime;	
  let tableKeys = ["system", "station", "sellPrice"];
	console.clear();
	screenContent.counters = getCounters();
  screenContent.topLocations = getMaxes().slice(0,50);
	console.table( [screenContent.counters], ['req', 'commoditiesReq', 'lastReqTime', 'ltdCount'] );
	if ( screenContent.lastMessage !== undefined ) console.log(screenContent.lastMessage);
  if ( screenContent.lastLocation) { 
		console.log("Latest LTD Location: ", moment(screenContent.lastLocation.timestamp).fromNow(true));
  	console.table([screenContent.lastLocation], tableKeys);
  }
	if (screenContent.maxLocation) {
    console.log("MAX Location: ", moment(screenContent.maxLocation.timestamp).fromNow(true) );
    console.table([screenContent.maxLocation], tableKeys);
  }  

	if (screenContent.topLocations) { 
    console.log("Captured Locations");
    console.table(screenContent.topLocations, tableKeys);
  }
}

function getCounters() { return counters };
function getMaxLocation() { return getMaxes()[0]; }

function updateMaxLocation ( loc ) {
  updateMaxLocations( loc );
  maxLocation = getMaxLocation();
}

function updateMaxLocations( target ) {
  const theMaxes = getMaxes();
  const stationMatch = theMaxes.findIndex( (e) => e.station === target.station && e.system === target.system );
  if ( stationMatch > -1 ) {
    if ( theMaxes[stationMatch].timestamp >= target.timestamp ) {
    	theMaxes[stationMatch] = target;
    	screenContent.lastMessage = target.system + " " + target.station + " updated!";
    } else {
			screenContent.lastMessage = "Old data for: " + target.system + " " + target.station;
		}
  } else {
    maxes.push(target);
    screenContent.lastMessage = target.system + " " + target.station + " added!";
  }
}

function getMaxes() { 
  return maxes = maxes.sort( function (max1, max2) {
    if ( max1.sellPrice > max2.sellPrice ) return 1;
    if ( max1.sellPrice < max2.sellPrice ) return -1;
    if ( max1.timestamp > max2.timestamp ) return 1;
    if ( max1.timestamp < max2.timestamp ) return -1;
  }).reverse();
}
