
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const PINF = require("pinf-for-nodejs");
const SPAWN = require("child_process").spawn;
const WAITFOR = require("waitfor");
const PROGRAM_INSIGHT = require("pinf-it-program-insight");


exports.for = function (module, implementation) {

	return PINF.main(function (options, callback) {

		function findProjectRoot (path, callback) {
			if (FS.existsSync(PATH.join(path, "program.json"))) {
				console.log("Using project root:", path);
				return callback(null, path);
			} else
			if (FS.existsSync(PATH.join(path, ".git"))) {
				console.log("Using project root:", path);
				return callback(null, path);
			}
			var newPath = PATH.dirname(path);
			if (newPath === path) {
				return callback(new Error("No project root found!"));
			}
			return findProjectRoot(newPath, callback);
		}

		return findProjectRoot(process.cwd(), function (err, rootPath) {
			if (err) return callback(err);

			function runCommands (commands, options, callback) {
				if (typeof options === "function" && typeof callback === "undefined") {
					callback = options;
					options = {};
				}
				options = options || {};
				options.cwd = options.cwd || rootPath;
			    var proc = SPAWN("bash", [
			        "-s"
			    ], {
			    	cwd: options.cwd
			    });

			    proc.on("error", function(err) {
			    	return callback(err);
			    });
			    var stdout = [];
			    var stderr = [];
			    proc.stdout.on('data', function (data) {
			    	stdout.push(data.toString());
					return process.stdout.write(data);
			    });
			    proc.stderr.on('data', function (data) {
			    	stderr.push(data.toString());
					return process.stderr.write(data);
			    });
			    proc.stdin.write(commands.join("\n"));
			    proc.stdin.end();
			    return proc.on('close', function (code) {
			    	if (code) {
			    		var err = new Error("Commands exited with code: " + code);
			    		err.stdout = stdout;
			    		err.stderr = stderr;
			    		return callback(err);
			    	}
			        return callback(null, stdout.join(""));
			    });
			}

			function getConfigFrom (descriptor, namespace) {
				if (
					!descriptor.config ||
					typeof descriptor.config[namespace] === "undefined"
				) {
					return null;
				}
				return descriptor.config[namespace];
			}

			function getPrograms (callback) {

				var programs = {};

				function forDirectory (directoryPath, callback) {
					var programDescriptorPath = directoryPath;
					if (!/\.json$/.test(programDescriptorPath)) {
						programDescriptorPath = PATH.join(programDescriptorPath, "program.json");
					}

					return PROGRAM_INSIGHT.parse(programDescriptorPath, {}, function(err, programDescriptor) {
						if (err) return callback(err);

						var didHaveProgram = false;
						if (
							programDescriptor.combined.boot &&
							programDescriptor.combined.boot.package
						) {
							programs[programDescriptorPath] = programDescriptor;
							didHaveProgram = true;
						}

						var waitfor = WAITFOR.serial(function (err) {
							if (err) return callback(err);
							return callback(null, programDescriptorPath);
						});

						var config = getConfigFrom(programDescriptor.combined, "github.com/pinf-to/to.pinf.lib/0");
						if (
							config &&
							config.programs
						) {
							for (var programId in config.programs) {
								var program = config.programs[programId];
								if (typeof program === "string") {
									program = {
										path: program
									}
								}
								waitfor(programId, program, function (programId, program, callback) {
									return forDirectory(PATH.join(PATH.dirname(programDescriptorPath), program.path), function (err, programDescriptorPath) {
										if (err) return callback(err);

										programs[programDescriptorPath]._declaringId = programId;
										programs[programDescriptorPath]._declaringDescriptor = program;

										return callback(null);
									});
								});
							}
						} else {
							if (!didHaveProgram) {
								console.log("No programs to publish configured at 'config[\"github.com/pinf-to/to.pinf.lib/0\"].programs' in '" + programDescriptor.descriptorPaths.join(", ") + "'");
							}
						}

						return waitfor();
					});
				}

				return forDirectory(rootPath, function (err) {
					if (err) return callback(err);
					return callback(null, programs);
				});
			}

			try {
				return implementation({
					ASSERT: ASSERT,
					PATH: PATH,
					FS: FS,
					SPAWN: require("child_process").spawn,
					EXEC: require("child_process").exec,
					WAITFOR: WAITFOR,
					REQUEST: require("request"),
					getRootPath: function () {
						return rootPath;
					},
					getConfigFrom: getConfigFrom,
					runCommands: runCommands,
					getPrograms: getPrograms
				}, function (err) {
					if (err) return callback(err);
					return callback();
				});
			} catch(err) {
				return callback(err);
			}
		});

	}, module);
}
