

exports.for = function (module, implementation) {

	return require("org.pinf.lib/bin/init").for(module, function (API, callback) {

	    API.pinfIT = function () {
	        return require("it.pinf.lib/bin/pit").for(API).then(function (PIT) {
	        	return PIT.turn();
	        });
	    }

		return callback();
	}, implementation);

}

