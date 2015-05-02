

exports.for = function (module, implementation) {

	return require("org.pinf.genesis.lib/bin/init").for(module, function (API, callback) {

		// @pattern https://github.com/pinf/require.async
		API.ASYNC.GULP = function (cb) {
			return cb(require("gulp"));
		};
		API.ASYNC.GULP_REPLACE = function (cb) {
			return cb(require("gulp-replace"));
		};
		API.ASYNC.GULP_FILTER = function (cb) {
			return cb(require("gulp-filter"));
		};
		API.ASYNC.GULP_RENAME = function (cb) {
			return cb(require("gulp-rename"));
		};
		API.ASYNC.GULP_DEBUG = function (cb) {
			return cb(require("gulp-debug"));
		};
		API.ASYNC.GULP_PLUMBER = function (cb) {
			return cb(require("gulp-plumber"));
		};
		API.ASYNC.GULP_EDIT = function (cb) {
			return cb(require("gulp-edit"));
		};
		API.ASYNC.GULP_WATCH = function (cb) {
			return cb(require("gulp-watch"));
		};

/*
	    API.pinfIT = function () {
	    	var self = this;
			return self.programDescriptor.getBootPackageDescriptor().then(function (packageDescriptor) {
				if (
					!packageDescriptor._data.exports ||
					!packageDescriptor._data.exports.bundles
				) {
					// No export bundles declared so we don't try and generate them.
					return API.Q.resolve();
				}

		    	if (!self.programDescriptor.configForLocator(self.LOCATOR.fromUid("github.com/pinf-it/pinf-it-bundler"))) {
		    		return API.Q.resolve();
		    	}

		        return require("it.pinf.lib/bin/pit.js").for(self).then(function (PIT) {
		        	return PIT.turn();
		        });
			});
	    }
*/

		return callback();
	}, implementation);

}

