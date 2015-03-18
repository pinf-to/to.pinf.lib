
exports.for = function (API) {

	return {
		spin: function () {

console.log("to.pinf.lib spin:", API.getRootPath());

			return API.Q.resolve();
		}
	}

}
