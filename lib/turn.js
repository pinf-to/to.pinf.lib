
exports.for = function (API) {

	return {
		turn: function () {

			function pinfTO () {

console.log("to.pinf.lib turn:", API.getRootPath());

				return API.loadPlugin().then(function (plugin) {

					const PLUGIN = plugin.for(API);

	console.log("PLUGIN", PLUGIN);
	console.log("root path", API.getRootPath());

				});
			}

			return API.pinfIT().then(function () {
				return pinfTO();
			});
		}
	}

}
