angular.module('app', [])

	.config(function(){

	})

	.factory('acsp', function($window, $rootScope){
		var acsp = {};
		var io = $window.io.connect();

		io.emit('hello');

		io.on('car_state', function(car_state){
			console.log('state:', car_state)
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
			$rootScope.$apply();
		})

		io.on('connection_closed',function(clientinfo){
			acsp.state[clientinfo.car_id].connected = false;
			$rootScope.$apply();
		});

		io.on('info', function(info){
			acsp.info = info;
			$rootScope.$apply();
		});

		// acsp.state = [];
		// for (var i = 0; i < 4; i++) {
		// 	acsp.state[i] = {};
		// }
		// acsp.state[0].pos = {x: 0, z: 151} // left
		// acsp.state[1].pos = {x: 433, z: 81} // top 
		// acsp.state[2].pos = {x: 565, z: 151} // right
		// acsp.state[3].pos = {x: 277, z: 208} // bot

		return acsp;
	})

	.controller('MainCtrl', function(acsp){
		this.acsp = acsp;

		this.map2map = function(car){
			return {
				top: (((car.pos.z - 80) / (208 - 80)) * (235-101)+101)+'px',
				left: (((car.pos.x - 0) / (565 - 0)) * (575-23)+23)+'px'
			}
		};
	})

;