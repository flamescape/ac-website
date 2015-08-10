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

var app = express().http().io();

var carState = [];
var sessionState = {};

var welcomeMessage = "Please visit our website: kiba.tv"

var contentPath = "D:\\SteamLibrary\\steamapps\\common\\assettocorsa\\content\\tracks";
var a = ACSP({host: '127.0.0.1', port: 11000});
a.setMaxListeners(50);

// start with requestion session info
a.getSessionInfo();
// and enabling the realtime report
a.enableRealtimeReport(50);

// SESSION EVENTS

a.on('session_info',function(sessioninfo){
    // reenable rt report, just in case
    a.enableRealtimeReport(50);
    // extend the sessionState with the new info
    _.extend(sessionState,sessioninfo);		
    // broadcast the new sesionState
    // app.io.broadcast('session_state',sessionState);
    // the track is now known, so request the map.ini and the ui_track.json	
    // TODO: We should do this only once, is memoize enough?
    getInfo().then(function(info){
        // once we get that broadcast the new sessionState
        sessionState.info = info;
        app.io.broadcast('session_state',sessionState);
    });
});

a.on('end_session',function(resultsPath){
    // nothting yet
});

// END SESSION EVENTS

// CLIENT EVENTS

a.on('new_connection',function(clientinfo){
    // if the car has not been initialized, init the car
    if(!carState[clientinfo.car_id]){ 
        initCar(clientinfo.car_id) ;
    }
    // if the client is a new driver re init the car
    if(clientinfo.driver_guid != carState[clientinfo.car_id].driver_guid){
        initCar(clientinfo.car_id);
    }
    // then extend the correct car state with the new info	
    _.extend(carState[clientinfo.car_id], clientinfo);	
    // then broadcast that info
    // app.io.broadcast('new_connection', carState[clientinfo.car_id]);
    app.io.broadcast('car_state',carState[clientinfo.car_id]);
});

// TODO: update to work with the client_loaded event
a.on('is_connected',function(car_id){
    // set is_connected to true for that car
    carState[car_id].is_connected = true;	
    // send the welcome message to that car
    a.sendChat(car_id,welcomeMessage);
    // broadcast the new carState for that car
    //app.io.broadcast('is_connected',carState[car_id];
    app.io.broadcast('car_state',carState[car_id];
});

a.on('connection_closed',function(clientinfo){
    // set is_connected to false for that car
    carState[clientinfo.car_id].is_connected = false;
    // broadcast the new carState for that car
    //app.io.broadcast('connection_closed',carState[clientinfo.car_id]);
    app.io.broadcast('car_state',carState[clientinfo.car_id]);
});

a.on('car_update',function(carupdate){
    // if that particular car has not been initialized
    if(!carState[carupdate.car_id]){
        // init the car
        initCar(carupdate.car_id);
        // and send a request for car info
        a.getCarInfo(carupdate.car_id);
    }
    // extend the carState with the new info
    _.extend(carState[carupdate.car_id],carupdate);
    // broadcast the carupdate
    app.io.broadcast('car_update', carupdate);
    // app.io.broadcast('car_state', car_state[carupdate.car_id]);
});

a.on('car_info',function(carinfo){
    // if the car has not been initialized (should not happen, but for safety)
    if(!carState[carinfo.car_id]) { 
        // init the car
        initCar(carinfo.car_id);
    }
    // then extend the car object with the new info
    _.extend(carState[carinfo.car_id],carinfo);
    // broadcast the new info
    app.io.broadcast('car_state',carState[carinfo.car_id]);
});

// END CLIENT EVENTS

// RACE EVENTS

a.on('lap_completed',function(clientinfo){
    // update the laps for the current car
    carState[clientinfo.car_id].laps[clientinfo.rlaps] = { time: clientinfo.laptime, 
        valid: (clientinfo.cuts == 0)
    };
    // update the leaderboard
    sessionState.leaderboard = clientinfo.leaderboard;
    // update the grip_level
    sessionState.grip_level = clientinfo.grip_level;
    // broadcast the new car info
    app.io.broadcast('car_state',carState[clientinfo.car_id]);
    // broadcast the new session info
    app.io.broadcast('session_state',sessionState);	
});

a.on('collide_car',function(clientinfo){
    a.sendChat(clientinfo.car_id,'Drive carefully!')
    a.sendChat(clientinfo.other_car_id,'Don\'t crash into people!')
});

a.on('collide_env',function(clientinfo){
    a.sendChat(clientinfo.car_id,'Be careful!')
});

// END RACE EVENTS

// CLIENT HANDLING

/* 
    Client has to listen to the following events
    'session_state' -> new/updated sessionState
    'all_car_state' -> state of all the cars
    'car_state'-> new/updated state of 1 car
    'car_update' -> realtime update of 1 car
*/

app.io.route('hello',function(req){
    req.io.emit('all_car_state',carState);
    req.io.emit('session_state',sessionState);
});

app.use(express.static(path.join(__dirname, './public')));

// TODO: ASK GARETH IF WE COULD DO THIS WITHOUT THE :id
app.get('/tracks/:id', function(req, res){	
    var trackPath = sessionState.track;
    if(sessionState.track_config != ""){
        trackPath = path.join(sessionState.track,sessionState.track_config);
    }
    var mapPath = path.join(contentPath, trackPath, 'map.png');
    fs.existsAsync(mapPath).then(function(exists){
        if (!exists) throw Error('File not found');
        res.sendfile(mapPath);
    }).catch(function(err){
        res.status(404).send('Nope!');
    });
});

app.listen(80);

// END CLIENT HANDLING

// HELPER FUNCTIONS

function initCar(car_id) {
    carState[car_id] = {		
        laps: [],
        is_connected: false
    };
}

// TODO: REMOVE /INFO REQUEST
var infoRequest = memoize(function infoRequest() {
    console.log('DOING EXPENSIVE REQUEST');
    return request({
        uri: 'http://localhost:8999/INFO',
        json: true
    }).spread(function(res, info){
        info.end_time = (new Date()).add({seconds: info.timeleft});		
        var iniPath = path.join(contentPath,sessionState.track,'data/map.ini');
        if(sessionState.track_config != ""){
            iniPath = path.join(contentPath,sessionState.track,sessionState.track_config,'data/map.ini');
        }
        return parseIni(iniPath).then(function(data){
            info.track_config = _.mapValues(data.PARAMETERS, function(val){
                return val*1;
            });
        }).return(info);
    }).then(function(info){
        var infoPath = path.join(contentPath,sessionState.track,'ui_track.json');
        if(sessionState.track_config != ""){
            infoPath = path.join(contentPath,sessionState.track,'ui',sessionState.track_config,'ui_track.json');
        }
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

// END HELPER FUNCTIONS



