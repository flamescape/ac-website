var ACSP = require('acsp');
var express = require('express.io');
var _ = require('lodash');
var Promise = require('bluebird');
var path = require('path');
var debug = require('debug')('ac-website');
var request = Promise.promisify(require('request'));
var fs = require('fs-extra-promise');

var app = express().http().io();

var carState = [];
var sessionState = {};

var contentPath = "D:\\SteamLibrary\\steamapps\\common\\assettocorsa\\content\\tracks";
var a = ACSP({host: '127.0.0.1', port: 11000});

a.enableRealtimeReport(50);
// a.broadcastChat('/admin test');

a.on('car_update', function(carupdate){
	debug('CARUPDATE', carupdate);
	if (!carState[carupdate.car_id]) carState[carupdate.car_id] = {};
	_.extend(carState[carupdate.car_id], carupdate);
	app.io.broadcast('car_update', carupdate);
});

a.on('new_connection',function(clientinfo){
	clientinfo.connected = true;
	clientinfo.bestLap = Infinity;
	clientinfo.laps = 1;
	carState[clientinfo.car_id] = clientinfo;
	debug('NEW PLAYER', clientinfo);
	app.io.broadcast('new_connection', clientinfo);
});

a.on('connection_closed',function(clientinfo){
	carState[clientinfo.car_id].connected = false;
});

a.on('lap_completed',function(clientinfo){	
	carState[clientinfo.car_id].laps += 1;
	if(clientinfo.cuts == 0){
		carState[clientinfo.car_id].lastLap = clientinfo.laptime;
		if(carState[clientinfo.car_id].bestLap > clientinfo.laptime){
			carState[clientinfo.car_id].bestLap = clientinfo.laptime;
		}
	}
	clientinfo.leaderboard.forEach(function(l){
		if (!carState[l.rcar_id]) return;
		carState[l.rcar_id].rtime = l.rtime;
		carState[l.rcar_id].rlaps = l.rlaps;
	});
	sessionState.grip_level = clientinfo.grip_level;
	app.io.broadcast('car_state', carState);
});
a.on('new_session',function(sessioninfo){
	// send out the new sessionState
	sessionState = sessioninfo;
	sessionState.ended = false;
	app.io.broadcast('session_state',sessioninfo);

	// Then clear all the laptimes for the next session
	carState = carState.map(function(car){
		car.bestLap = 0;
		car.lastLap = 0;
		car.laps = 0;
		return car;
	});

	// also send out the new server info
	// request({
	// 	uri: 'http://localhost:8999/INFO',
	// 	json: true
	// }).spread(function(res, body){
	// 	req.io.emit('info', body);		
	// })

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
});

app.io.route('hello', function(req){
	req.io.emit('car_state', carState);
	req.io.emit('session_state', sessionState);

	request({
		uri: 'http://localhost:8999/INFO',
		json: true
	}).spread(function(res, info){
		return fs.readJsonAsync('./cfg/tracks/' + info.track + '.json').then(function(config){
			info.track_config = config;
			req.io.emit('info', info);
		});
	});
});

app.io.route('new_session_info',function(req){
	req.io.emit('session_state', sessionState);

});

app.use(express.static(path.join(__dirname, './public')));

app.get('/tracks/:id', function(req, res){
	var trackPath = req.params.id.replace(/-/g, '/');
	var mapPath = path.join(contentPath, trackPath, 'map.png');
	fs.existsAsync(mapPath).then(function(exists){
		if (!exists) throw Error('File not found');
		res.sendfile(mapPath);
	}).catch(function(err){
		res.status(404).send('Nope!');
	});
});

app.listen(80);
