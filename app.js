const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');


class MessageService {

	constructor() { this.messages = []; }

	async find() {
		return this.messages;
  }

	async create (data) {
		const message = {
			id: this.messages.length,
			text: data.text
    }
		
    this.messages.push(message);
		return message;	
  } 
}

const app = express(feathers());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(__dirname));
app.configure(express.rest());
app.configure(socketio());
app.use('/messages', new MessageService);

app.on('connection', connection => 
	app.channel('everybody').join(connection)
);

app.publish(data => app.channel('everybody'));


const zlib = require('zlib');
const zmq = require('zeromq');
const sock = zmq.socket('sub');
const moment = require('moment');


moment.relativeTimeThreshold('ss', 1);
console.log('beginning SQL.media LTD price detector');
sock.connect('tcp://eddn.edcd.io:9500');
console.log('Worker connected to EDDN Firehose');
let maxLocation = { "system": "SQL", "station": ".media", "sellPrice": 0, "timestamp": new Date()};
let maxes = [];
let counters = { req: 0, commoditiesReq: 0, lastReqTime: undefined, ltdCount:0 };
updateMaxLocation(maxLocation);
sock.on('message', topic => {
  let theCounters = getCounters();
  theCounters.req++;
  let content = JSON.parse(zlib.inflateSync(topic));
  theCounters.lastReqTime = moment(content.message.timestamp).fromNow();
  if ( content['$schemaRef'] === 'https://eddn.edcd.io/schemas/commodity/3' ) { 
    theCounters.commoditiesReq++;
    let commodities = content.message.commodities;	
    let system = content.message.systemName;
    let station = content.message.stationName;
    let msg = { text: "none", lastStation: system + " " + station, latestltd: "", maxltd: "" };
    commodities.forEach( item  => { 
      if ( item.name == "lowtemperaturediamond" ) { 
				console.clear();
        getCounters().ltdCount++;
	      let thisItem = { "system": system,  "station": station, "sellPrice": item.sellPrice, "timestamp": new Date(content.message.timestamp) };
	      let maxLoc = getMaxLocation();
        if ( thisItem.sellPrice > maxLoc.sellPrice ) {
          console.log( "NEW MAX PRICE!!!!" );
          updateMaxLocation(thisItem);
        } else {
	        updateMaxLocations( thisItem );
	      }
	

				maxLoc = getMaxLocation();
				let tableKeys = ["system", "station", "sellPrice"];
        msg.text = JSON.stringify( maxLoc );
				console.table( [counters], ['req', 'commoditiesReq', 'lastReqTime', 'ltdCount'] );
        console.log("Latest LTD Location: ", moment(thisItem.timestamp).fromNow(true));
        console.table([thisItem], tableKeys);
				msg.latestltd = JSON.stringify(thisItem);
        console.log("MAX Location: ", moment(maxLoc.timestamp).fromNow(true) );
        console.table([maxLoc], tableKeys);
        msg.maxltd = JSON.stringify(maxLoc);
        console.log("Captured Locations");
				
				msg = JSON.stringify(msg);
				app.emit('updated',{ message: JSON.stringify(msg) } );
        console.table(getMaxes().slice(0,60), tableKeys);
      } else { 
				getCounters().otherCount++;
      }
    }); 
  } 

});

app.on('updated', data => console.log('updated happened', data ));

app.listen(3030).on('listening', () => {
  console.log('listening on localhost:3030');
});

app.service('messages').create({ text: "server says..." });


function getCounters() { return counters };
function getMaxLocation() { return getMaxes()[0]; }

function updateMaxLocation ( location ) {
  updateMaxLocations( location );
  maxLocation = getMaxLocation();
}

function updateMaxLocations( target ) {
  const theMaxes = getMaxes();
  const sysMatch = theMaxes.findIndex( (e) => e.system === target.system );
  const stationMatch = theMaxes.findIndex( (e) => e.station === target.station );
  if (sysMatch === -1 ) {
    maxes.push(target);
  } else if ( sysMatch !== stationMatch ) {
    maxes.push(target);
  } else if ( sysMatch === stationMatch && theMaxes[sysMatch].timestamp < target.timestamp) {
    maxes[stationMatch] = target;
    console.log( target.system + " updated!" );
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
