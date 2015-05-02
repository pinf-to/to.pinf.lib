
exports.for = function (API) {

	return {
		turn: function () {
			return API.Q.resolve();
		}
	}

}
