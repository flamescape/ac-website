var ACSP = require('acsp');
var express = require('express.io');
var _ = require('lodash');
var Promise = require('bluebird');
var path = require('path');
var debug = require('debug')('ac-website');
var request = Promise.promisify(require('request'));
var fs = require('fs-extra-promise');
var parseIni = Promise.promisify(require('iniparser').parse);
var memoize = require('memoizee');
require('date-utils');
Promise.longStackTraces();

var app = express().http().io();



var carState = [];

var welcomeMessage = "Please visit our website: kiba.tv"

var contentPath = "D:\\SteamLibrary\\steamapps\\common\\assettocorsa\\content\\tracks";
var a = ACSP({host: '127.0.0.1', port: 11000});
a.setMaxListeners(50);

var listeners = 0;
a.on('newListener', function(){
	listeners++;
	debug('added a listener, now have %s listeners', listeners);
})

a.on('removeListener', function(){
	listeners--;
	debug('removed a listener, now have %s listeners', listeners);
})

var infoRequest = memoize(function infoRequest() {
	console.log('DOING EXPENSIVE REQUEST');
	return request({
		uri: 'http://localhost:8999/INFO',
		json: true
	}).spread(function(res, info){
		info.end_time = (new Date()).add({seconds: info.timeleft});		
		var iniPath = path.join(contentPath,getTrackFolder(info.track),'data/map.ini');
		return parseIni(iniPath).then(function(data){
			info.track_config = _.mapValues(data.PARAMETERS, function(val){
				return val*1;
			});
		}).return(info);
	}).then(function(info){
		var infoPath = path.join(contentPath,getTrackUiFolder(info.track),'ui_track.json');
		return fs.readJsonAsync(infoPath).then(function(ui){
			info.ui = ui;
			return info;
		});
	})
});

function getInfo() {
	return infoRequest().then(function(info){
		//console.log('INFO',info);
		info.timeleft = Math.max((new Date).getSecondsBetween(info.end_time), 0);
		return info;
	});
}
function initCar(car_id) {
	carState[car_id] = {
		bestLap: Infinity,
		lastLap: Infinity,
		laps: 0,
		is_connected: false
	};
}

function getTrackFolder(trackName){	
	var trackPath = path.join(contentPath,trackName.toString());	
	if(fs.existsSync(trackPath)){ return trackName.toString(); }
	else{ return trackName.replace(/-/g, '/'); }
}
function getTrackUiFolder(trackName){	
	var trackPath = path.join(contentPath,trackName.toString(),'ui');	
	if(fs.existsSync(trackPath)){ return path.join(trackName.toString(),'ui'); }
	var track = trackName.split(/-/g);
	return path.join(track[0],'ui',track[1]);
}


// this is just for testing
// REMOVE AFTER TESTING!!!
getInfo().then(function(info){
	debug('info', info);
	debug('Initialising %s clients', info.maxclients);
	for (var i = 0; i < info.maxclients; i++) {
		initCar(i);
		a.getCarInfo(i);
	}
}).catch(function(){});

a.on('new_session', function(){
	console.log('NEW SESSION STARTED! RESETTING INFO');
	infoRequest.clear();
	getInfo().then(function(info){
		for (var i = 0; i < info.maxclients; i++) {
			initCar(i);
			a.getCarInfo(i);
		}
	});
});

a.on('car_update', function(carupdate){
	// debug('CARUPDATE', carupdate);
	_.extend(carState[carupdate.car_id], carupdate);
	app.io.broadcast('car_update', carupdate);
});

a.on('car_info', function(carinfo){
	if(carinfo.is_connected) {
		_.extend(carState[carinfo.car_id],carinfo);
	}
	app.io.broadcast('car_info', carState[carinfo.car_id]);
});

a.on('is_connected',function(car_id){
	carState[car_id].is_connected = true;
	debug('Welcome Message to:', car_id);
	a.sendChat(car_id,welcomeMessage);
	app.io.broadcast('is_connected',car_id);
});

a.on('new_connection',function(clientinfo){
	// if the client is a new driver re init the car
	if(clientinfo.driver_guid != carState[clientinfo.car_id].driver_guid){
		initCar(clientinfo.car_id);
	}	
	_.extend(carState[clientinfo.car_id], clientinfo);
	debug('NEW PLAYER', clientinfo);
	
	app.io.broadcast('new_connection', carState[clientinfo.car_id]);
});

a.on('connection_closed',function(clientinfo){
	carState[clientinfo.car_id].is_connected = false;
	app.io.broadcast('connection_closed',carState[clientinfo.car_id]);
});

a.on('lap_completed',function(clientinfo){	
	carState[clientinfo.car_id].laps += 1;
	if(clientinfo.cuts == 0){
		carState[clientinfo.car_id].lastLap = clientinfo.laptime;
		if(carState[clientinfo.car_id].bestLap > clientinfo.laptime){
			carState[clientinfo.car_id].bestLap = clientinfo.laptime;
		}
	}
	carState[clientinfo.car_id].leaderboard = clientinfo.leaderboard;
	sessionState.grip_level = clientinfo.grip_level;
	app.io.broadcast('car_state', carState);
});
a.on('new_session',function(sessioninfo){
	a.enableRealtimeReport(50);
	// send out the new sessionState
	sessionState = sessioninfo;
	sessionState.ended = false;
	app.io.broadcast('session_state',sessioninfo);

	app.io.broadcast('car_state', carState);


	getInfo().then(function(info){
		app.io.broadcast('info', info);
	});
});

a.on('collide_car',function(clientinfo){
	a.sendChat(clientinfo.car_id,'Drive carefully!')
	a.sendChat(clientinfo.other_car_id,'Don\'t crash into people!')
});
a.on('collide_env',function(clientinfo){
	a.sendChat(clientinfo.car_id,'Be careful!')
});


a.on('end_session',function(){
	sessionState.ended = true;
	app.io.broadcast('session_state',sessionState);
	// TODO: store all the laptimes
	// carState = carState.filter(function(car){
	// 	return car.connected;
	// });
});

app.io.route('hello', function(req){
	req.io.emit('car_state', carState);
	req.io.emit('session_state', sessionState);

	getInfo().then(function(info){
		// var iniPath = path.join(contentPath,info.track,'data','map.ini');
		// return iniparser.parse(iniPath,function(err, data){			
		// 	info.track_config = _.mapValues(data.PARAMETERS, function(val){
		// 		return val*1;
		// 	});
		// 	req.io.emit('info',info);
		// });
		// return fs.readJsonAsync('./cfg/tracks/' + info.track + '.json').then(function(config){
		// 	info.track_config = config;
			req.io.emit('info', info);
		// });
	});
});

app.io.route('new_session_info',function(req){
	req.io.emit('session_state', sessionState);
});

app.use(express.static(path.join(__dirname, './public')));

app.get('/tracks/:id', function(req, res){
	var trackPath = getTrackFolder(req.params.id);
	var mapPath = path.join(contentPath, trackPath, 'map.png');
	fs.existsAsync(mapPath).then(function(exists){
		if (!exists) throw Error('File not found');
		res.sendfile(mapPath);
	}).catch(function(err){
		res.status(404).send('Nope!');
	});
});

app.listen(80);
