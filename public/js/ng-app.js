angular.module('app', [])

	.config(function(){

	})

	.factory('acsp', function($window, $rootScope){
		var acsp = {};
		var io = $window.io.connect();

		io.emit('hello');

		io.on('car_state', function(car_state){
			//console.log('state:', car_state)
			acsp.state = car_state;
			$rootScope.$apply();
		});

		io.on('new_connection',function(client_info){
			acsp.state[client_info.car_id] = client_info;
			$rootScope.$apply();
		});

		io.on('car_update', function(car_update){
			_.extend(acsp.state[car_update.car_id], car_update);
			acsp.lastUpdate = car_update;
			$rootScope.$apply();
		});

		io.on('session_state', function(session_state){
			acsp.sessionState = session_state;
			console.log(session_state.type)
			// if not in a race, reset the timer
			if(acsp.sessionState.type != 3){				
				acsp.info.timeleft = acsp.info.durations[acsp.sessionState.type - 1] * 60
			}			
			// Then clear all the laptimes for the next session
			console.log(acsp.state[0])
			acsp.state = acsp.state.map(function(car){
				car.bestLap = 0;
				car.lastLap = 0;
				car.laps = 0;
				return car;
			});
			$rootScope.$apply();
		})

		io.on('connection_closed',function(clientinfo){
			acsp.state[clientinfo.car_id].connected = false;
			$rootScope.$apply();
		});

		io.on('info', function(info){			
			acsp.info = info;

			// start the session timer			
			setInterval(function(){
				acsp.info.timeleft -= 1;
				$rootScope.$apply();
			},1000)						
			$rootScope.$apply();
		});

		acsp.state = [];
		for (var i = 0; i < 4; i++) {
			acsp.state[i] = {};
		}

		// acsp.state[0].pos = {x: 0, z: 151} // left
		// acsp.state[1].pos = {x: 433, z: 81} // top 
		// acsp.state[2].pos = {x: 565, z: 151} // right
		// acsp.state[3].pos = {x: 277, z: 208} // bot

		// acsp.state[0].driver_name = 'Bjorn';
		// acsp.state[0].car_model = 'Abarth500'
		// acsp.state[0].bestLap = 73353;
		// acsp.state[0].rlaps = 1;
		// acsp.state[0].normalized_spline_pos = 0.5;

		// acsp.state[1].driver_name = 'Gareth';
		// acsp.state[1].car_model = 'Abarth500'
		// acsp.state[1].bestLap = 63353;
		// acsp.state[1].rlaps = 2;
		// acsp.state[1].normalized_spline_pos = 0.1;

		return acsp;
	})

	.filter('toLapTime', function(){
		return function(time, format){
			return !time ? "-" : moment.utc(time).format(format || "m:ss.SSS");
		};
	})

	.controller('MainCtrl', function(acsp){
		this.acsp = acsp;

		

		this.map2map = function(car){
			var a = acsp.info.track_config.anchor_points;
			return {
				top: (((car.pos.z - a.game.min.z) / (a.game.max.z - a.game.min.z)) * (a.map.max.y-a.map.min.y)+a.map.min.y)+'px',
				left: (((car.pos.x - a.game.min.x) / (a.game.max.x - a.game.min.x)) * (a.map.max.x-a.map.min.x)+a.map.min.x)+'px'
			}
		};

		this.orderFunction = function(car){
			var session = acsp.sessionState.type;
			// if in race
			if(session == 3){
				// return the car in front
				return -(car.laps + car.normalized_spline_pos);
			}
			// if in any other session
			else if(car.bestLap){
				// return the best lap
				return car.bestLap;
			}			
			// no time has been set
			else if(!car.bestLap){				
				return Infinity;
			}
		};
		this.leaderLap = function(){
			return _.max(_.pluck(acsp.state, 'laps')) | 0;
		}	
	})

;