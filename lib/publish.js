
const PATH = require("path");
const FS = require("fs-extra");
const PINF = require("pinf-for-nodejs");
const SPAWN = require("child_process").spawn;
const WAITFOR = require("waitfor");
const PROGRAM_INSIGHT = require("pinf-it-program-insight");
const GULP = require("gulp");


exports.for = function (module, publisher) {

	PINF.main(function (options, callback) {

		function findProjectRoot (path, callback) {
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

			function runCommands (commands, callback) {
			    var proc = SPAWN("bash", [
			        "-s"
			    ], {
			    	cwd: rootPath
			    });

			    proc.on("error", function(err) {
			    	return callback(err);
			    });
			    var stdout = [];
			    proc.stdout.on('data', function (data) {
			    	stdout.push(data.toString());
					return process.stdout.write(data);
			    });
			    proc.stderr.on('data', function (data) {
					return process.stderr.write(data);
			    });
			    proc.stdin.write(commands.join("\n"));
			    proc.stdin.end();
			    return proc.on('close', function (code) {
			    	if (code) {
			    		return callback(new Error("Commands exited with code: " + code));
			    	}
			        return callback(null, stdout.join(""));
			    });
			}

			function getConfigFrom (programDescriptor, namespace) {
				if (
					!programDescriptor.combined.config ||
					typeof programDescriptor.combined.config[namespace] === "undefined"
				) {
					return null;
				}
				return programDescriptor.combined.config[namespace];
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

						var waitfor = WAITFOR.serial(callback);

						var config = getConfigFrom(programDescriptor, "github.com/pinf-to/to.pinf.lib/0");
						if (
							config &&
							config.programs
						) {
							for (var programId in config.programs) {
								waitfor(
									PATH.join(PATH.dirname(programDescriptorPath), config.programs[programId]),
									forDirectory
								);
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

			var exitOnDirty = true;
			if (process.env.npm_config_argv) {
				if (JSON.parse(process.env.npm_config_argv).original.indexOf("--ignore-dirty") !== -1) {
					exitOnDirty = false;
				}
			} else
			if (process.argv.indexOf("--ignore-dirty") !== -1) {
				exitOnDirty = false;
			}
			return runCommands([
		    	// @source http://stackoverflow.com/a/2658301
		    	'function evil_git_dirty {',
				'  [[ $(git diff --shortstat 2> /dev/null | tail -n1) != "" ]] && echo "*"',
				'}',
				'function parse_git_branch {',
				'  git branch --no-color 2> /dev/null | sed -e \'/^[^*]/d\' -e \'s/* \\(.*\\)/\\1/\'',
				'}',
				'BRANCH=$(parse_git_branch)',
				'echo "Publishing from branch: $BRANCH"',
				// TODO: Prevent this from writing to stdout during if comparison.
				'if evil_git_dirty = "*"; then',
				'  echo "\n\n  Commit changes to git first! Use --ignore-dirty to skip this verification and proceed with a dirty git tree.\n\n";',
				exitOnDirty ? '  exit 1;' : '',
				'fi'
			], function (err, stdout) {
				if (err) return callback(err);

				var gitBranch = stdout.match(/Publishing from branch:\s([^\n]+)\n/)[1];

				function onError (err) {
					return runCommands([
						'git checkout ' + gitBranch
					], function () {
						return callback(err);
					});
				}

				try {
					return publisher({
						PATH: PATH,
						FS: FS,
						WAITFOR: WAITFOR,
						GULP: GULP,
						GULP_REPLACE: require("gulp-replace"),
						GULP_FILTER: require("gulp-filter"),
						getRootPath: function () {
							return rootPath;
						},
						getConfigFrom: getConfigFrom,
						getGitBranch: function () {
							return gitBranch;
						},
						runCommands: runCommands,
						getPrograms: getPrograms
					}, function (err) {
						if (err) return onError(err);
						return callback();
					});
				} catch(err) {
					return onError(err);
				}
			});
		});

	}, module);
}
