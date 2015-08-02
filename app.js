var ACSP = require('acsp');
var express = require('express.io');
var _ = require('lodash');
var Promise = require('bluebird');
var path = require('path');
var debug = require('debug')('ac-website');


var app = express().http().io();

var carState = [];
var sessionState = {};

var a = ACSP({host: '127.0.0.1', port: 11000});

a.enableRealtimeReport(500);

a.on('car_update', function(carupdate){
	debug('CARUPDATE', carupdate);
	if (!carState[carupdate.car_id]) carState[carupdate.car_id] = {};
	_.extend(carState[carupdate.car_id], carupdate);
	app.io.broadcast('car_update', carupdate);
});

a.on('new_connection',function(clientinfo){
	clientinfo.connected = true;
	clientinfo.bestLap = Infinity;
	carState[clientinfo.car_id] = clientinfo;
	debug('NEW PLAYER', clientinfo);
	app.io.broadcast('new_connection', clientinfo);
});

a.on('connection_closed',function(clientinfo){
	carState[clientinfo.car_id].connected = false;
});

a.on('lap_completed',function(clientinfo){	
	if(clientinfo.cuts == 0 && carState[clientinfo.car_id].bestLap > clientinfo.laptime){
		carState[clientinfo.car_id].bestLap = clientinfo.laptime;
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
	sessionState = sessioninfo;
	sessionState.ended = false;
	app.io.broadcast('session_state',sessioninfo);

});

a.on('end_session',function(){
	sessionState.ended = true;
	app.io.broadcast('session_state',sessioninfo);
});

app.io.route('hello', function(req){
	req.io.emit('car_state', carState);
	req.io.emit('session_state', sessionState);
});

app.use(express.static(path.join(__dirname, './public')));

app.listen(80);
