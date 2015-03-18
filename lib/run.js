
exports.for = function (module, runner) {

	console.log("DEPRECATED: to.pinf.lib/lib/run.js; use 'pto show' instead");

	return require("./common").for(module, function (_API, callback) {
		var API = {};
		for (var name in _API) {
			API[name] = _API[name];
		}

		try {
			return runner(API, function (err) {
				if (err) return callback(err);
				return callback();
			});
		} catch(err) {
			return callback(err);
		}
	});
}
