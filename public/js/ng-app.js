angular.module('app', [])

	.config(function(){

	})

	.factory('acsp', function($window, $rootScope, $interval){
		var acsp = {};
		var io = $window.io.connect();

		io.emit('hello');

		io.on('car_state', function(car_state){
			//console.log('state:', car_state)
			console.log('new car state!');
			acsp.state = car_state;
			$rootScope.$apply();
		});

		io.on('new_connection',function(client_info){
			acsp.state[client_info.car_id] = client_info;			
			$rootScope.$apply();
		});

		io.on('is_connected',function(car_id){
			acsp.state[car_id].is_connected = true;
			$rootScope.$apply();
		})

		io.on('car_update', function(car_update){
			_.extend(acsp.state[car_update.car_id], car_update);
			acsp.lastUpdate = car_update;
			$rootScope.$apply();
		});

		io.on('session_state', function(session_state){
			acsp.sessionState = session_state;

			// start the session timer								
			// // if not in a race, reset the timer
			// if(acsp.sessionState.type != 3){				
			// 	acsp.info.timeleft = acsp.info.durations[acsp.sessionState.type - 1] * 60
			// }			
			// // Then clear all the laptimes for the next session
			// console.log(acsp.state[0])
			// acsp.state = acsp.state.map(function(car){
			// 	car.bestLap = 0;
			// 	car.lastLap = 0;
			// 	car.laps = 0;
			// 	return car;
			// });
			$rootScope.$apply();
		})

		io.on('connection_closed',function(clientinfo){
			acsp.state[clientinfo.car_id].is_connected = false;
			$rootScope.$apply();
		});

		io.on('info', function(info){			
			acsp.info = info;
			$rootScope.$apply();
			// start the session timer			
			// startTimer();
		});

		$interval(function(){
			acsp.info.timeleft -= 1;				
		}, 1000);

		// acsp.state = [];
		// for (var i = 0; i < 4; i++) {
		// 	acsp.state[i] = {};
		// }

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

	.filter('propercase', function(){
		return function(text){
			if (!text) return "";
			text = text.toString();
			return text.substr(0,1).toUpperCase() + text.substr(1).toLowerCase();
		};
	})
	.filter('connected_clients',function(){
		return function(clients){
			return clients.filter(function(client){
				return client.is_connected;
			}).length;
		};
	})

	.controller('MainCtrl', function(acsp){
		this.acsp = acsp;	

		this.selectedCar = null;
		this.getCarInfo = function(car_id){
			if (this.selectedCar === car_id) {
				this.selectedCar = null;
			} else {
				this.selectedCar = car_id;
			}

			// $scope.getPartial = function(){
			// 	return 'partials/car_info.html'
			// }
		}	

		this.map2map = function(car){
			var a = acsp.info.track_config;	

			if(!car.pos) return {display: 'none'};

			var img_scale_factor = 250 / a.WIDTH;

			var x = ((car.pos.x + a.X_OFFSET) / a.SCALE_FACTOR) * img_scale_factor;
			var y = ((car.pos.z + a.Z_OFFSET) / a.SCALE_FACTOR) * img_scale_factor;

			var style = {
				top: y +'px',
				left: x +'px'
			};

			if (this.selectedCar == car.car_id) {
				style.background = 'blue';
				style['z-index'] = 10;
			}

			return style;
		};
		this.orderFunction = function(car){
			var session = acsp.sessionState.type;
			// if in race
			if(session == 3){
				// return the car in front
				if(!car.normalized_spline_pos){
					return -(car.laps - 1);
				}

				return -(car.laps + car.normalized_spline_pos);				
			}
			// if in any other session
			else if(car.bestLap){
				// return the best lap
				return car.bestLap;
			}			
			// no time has been set
			else if(!car.bestLap){				
				return car.car_id;
			}
		};
		this.leaderLap = function(){
			return _.max(_.pluck(acsp.state, 'laps')) | 0;
		}	
	})

;