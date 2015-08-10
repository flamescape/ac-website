
angular.module('app', [])

	.config(function () {

	})

	.factory('acsp', function ($window, $rootScope, $interval) {
	    var acsp = {};
	    var io = $window.io.connect();

	    io.emit('hello');

	    io.on('all_car_state', function (car_state) {
	        acsp.car_state = car_state;
	        $rootScope.$apply();
	    });
	    io.on('session_state', function (session_state) {
	        acsp.session_state = session_state;
	        $rootScope.$apply();
	    });
	    io.on('car_state', function (car_state) {
            // if the car does not exist yet, initialize it
	        if (!acsp.car_state[car_state.car_id]) {
	            acsp.car_state[car_state.car_id] = {};
	        }
	        // extend the car with the new info
	        _.extend(acsp.car_state[car_state.car_id], car_state);
	        $rootScope.$apply();
	    });
	    io.on('car_update', function (car_update) {
	        // if the car does not exist yet, initialize it
	        if (!acsp.car_state[car_state.car_id]) {
	            acsp.car_state[car_state.car_id] = {};
	        }
	        // extend the car with the new info
	        _.extend(acsp.car_state[car_state.car_id], car_update);
	        $rootScope.$apply();
	    });

	    return acsp;
	})

    .filter('toLapTime', function () {
        return function (time, format) {
            return !time ? "-" : moment.utc(time).format(format || "m:ss.SSS");
        };
    })
    .filter('connected_clients', function () {
        return function (clients) {
            return clients.filter(function (client) {
                return client.is_connected;
            }).length;
        };
    })

	.controller('MainCtrl', function (acsp) {
	    this.acsp = acsp;

	    this.selectedCar = null;
	    this.getCarInfo = function (car_id) {
	        if (this.selectedCar === car_id) {
	            this.selectedCar = null;
	        } else {
	            this.selectedCar = car_id;
	        }	       
	    }

	    this.map2map = function (car) {
	        var a = acsp.session_state.info.track_config;

	        if (!car.pos) return { display: 'none' };

	        var img_scale_factor = 250 / a.WIDTH;

	        var x = ((car.pos.x + a.X_OFFSET) / a.SCALE_FACTOR) * img_scale_factor;
	        var y = ((car.pos.z + a.Z_OFFSET) / a.SCALE_FACTOR) * img_scale_factor;

	        var style = {
	            top: y + 'px',
	            left: x + 'px'
	        };

	        if (this.selectedCar == car.car_id) {
	            style.background = 'blue';
	            style['z-index'] = 10;
	        }

	        return style;
	    };
	    this.orderFunction = function (car) {
	        var session = acsp.session_state.type;
	        // if in race
	        if (session == 3) {
	            // return the car in front
	            if (!car.normalized_spline_pos) {
	                return -(car.laps - 1);
	            }

	            return -(car.laps + car.normalized_spline_pos);
	        }
	            // if in any other session
	        else if (car.bestLap) {
	            // return the best lap
	            return car.bestLap;
	        }
	            // no time has been set
	        else if (!car.bestLap) {
	            return car.car_id;
	        }
	    };
	    this.leaderLap = function () {
	        return _.max(_.pluck(acsp.sessionState.leaderboard, 'rlaps')) | 0;
	    }
	})

;