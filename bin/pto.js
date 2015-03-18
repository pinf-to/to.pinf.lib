
exports.for = function (API) {
    return require("../lib/_common").for([API, module], {
        turn: require("../lib/turn"),
        spin: require("../lib/spin")
    });
}

if (require.main === module) {
    exports.for(module);
}
