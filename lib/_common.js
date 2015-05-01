

exports.for = function (module, implementation) {

	return require("org.pinf.genesis.lib/bin/init").for(module, function (API, callback) {

		API.GULP = require("gulp");
		API.GULP_REPLACE = require("gulp-replace");
		API.GULP_FILTER = require("gulp-filter");
		API.GULP_RENAME = require("gulp-rename");
		API.GULP_DEBUG = require("gulp-debug");
		API.GULP_PLUMBER = require("gulp-plumber");
		API.GULP_EDIT = require("gulp-edit");
		API.GULP_WATCH = require("gulp-watch");

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

