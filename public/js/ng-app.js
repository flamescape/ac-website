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

		return acsp;
	})

	.controller('MainCtrl', function(acsp){
		this.acsp = acsp;
	})

;