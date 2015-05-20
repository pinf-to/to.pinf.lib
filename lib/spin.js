
// TODO: Use a color lib that does not modify globals. i.e. Use one that proxies logging calls and
//       parses simple color syntax.
const COLORS = require("colors");
COLORS.setTheme({
    error: 'red'
});


exports.for = function (API) {


	// TODO: Put this into utility module/package.
	function getProcesses (callback) {

		var processes = {
			byPid: {},
		};
		var columns;

		function makeRow (columns, fields) {
			var row = {};
			fields.forEach(function (field, index) {
				if (columns[index]) {
					row[columns[index]] = field;
				} else {
					row[columns[columns.length - 1]] += " " + field;
				}
			});
			return row;
		}


		var proc = API.SPAWN("bash");
		proc.stderr.on('data', function (data) {
		  console.log('stderr: ' + data);
		});
		var buffer = [];
		proc.stdout.on('data', function (data) {
			buffer.push(data.toString());
		});
		proc.on('close', function (code) {
			if (code !== 0) {
				return callback(new Error("Process exit status != 0"));
			}
			columns = null;
			buffer.join("").split("\n").forEach(function (line) {
				if (!line) return;
				var fields = line.replace(/[\t\s]+/g, " ").replace(/(^\s|\s$)/g, "").split(/\s/);

				if (fields[0] === "PPID" || fields[0] === "USER") {
					columns = fields;
				} else {
					// @see http://www.cs.miami.edu/~geoff/Courses/CSC521-04F/Content/UNIXProgramming/UNIXProcesses.shtml
					// @see http://chinkisingh.com/2012/06/10/session-foreground-processes-background-processes-and-their-interaction-with-controlling-terminal/					
					var process = makeRow(columns, fields);
					// process.PID - Process ID
					// process.PPID - Parent process ID
					// process.PGID - Parent group ID
					// process.SID - Session leader ID
					// process.TPGID - Terminal process group ID
					// process.TTY - (TeleTYpewriter) The terminal that executed a particular command ; @see http://stackoverflow.com/a/7113800/330439
					// process.STAT - Process state ; @see http://unix.stackexchange.com/a/18477/92833
					//	 states:
					//		D Uninterruptible sleep (usually IO)
					//		R Running or runnable (on run queue)
					//		S Interruptible sleep (waiting for an event to complete)
					//		T Stopped, either by a job control signal or because it is being traced.
					//		W paging (not valid since the 2.6.xx kernel)
					//		X dead (should never be seen)
					//		Z Defunct ("zombie") process, terminated but not reaped by its parent.
					//   flags:
					//		< high-priority (not nice to other users)
					//		N low-priority (nice to other users)
					//		L has pages locked into memory (for real-time and custom IO)
					//		s is a session leader
					//		l is multi-threaded (using CLONE_THREAD, like NPTL pthreads do)
					//		+ is in the foreground process group
					// process.UID - User ID ; @see http://stackoverflow.com/a/205146/330439
					// process.START - Indication of how long the process has been up
					// process.TIME - Accumulated CPU utilization time ; @see http://www.theunixschool.com/2012/09/ps-command-what-does-time-indicate.html
					// process.USER - Username of PID
					// process.COMMAND - The command being executed
					// process.%CPU - % of current total CPU utilization
					// process.%MEM - % of current total MEM utilization
					// process.VSZ - (Virtual Memory Size) Accessible memory including swap and shared lib ; @see http://stackoverflow.com/a/21049737/330439
					// process.RSS - (Resident Set Size) Allocated ram ; @see http://stackoverflow.com/a/21049737/330439

					if (!processes.byPid[process.PID]) {
						processes.byPid[process.PID] = {};
					}
					if (!processes.byPid[process.PID].info) {
						processes.byPid[process.PID].info = {};
					}
					for (var name in process) {
						if (typeof processes.byPid[process.PID].info[name] === "undefined") {
							processes.byPid[process.PID].info[name] = process[name];
						}
					}

					if (process.PPID) {
						if (!processes.byPid[process.PPID]) {
							processes.byPid[process.PPID] = {};
						}
						if (!processes.byPid[process.PPID].children) {
							processes.byPid[process.PPID].children = [];
						}
						if (processes.byPid[process.PPID].children.indexOf(process.PID) === -1) {
							processes.byPid[process.PPID].children.push(process.PID);
						}
					}

				}
			});

			return callback(null, processes)
		});
		proc.stdin.write("ps axo ppid,pid,command");
		return proc.stdin.end();
	}

	function killPIDs (pids, callback) {

		var command = "kill " + pids.join(" ");

		console.log(("Run: " + command).magenta);

		return API.EXEC(command, function (err, stdout, stderr) {
			if (stdout) process.stdout.write(stdout);
			if (stderr) process.stderr.write(stderr);
			if (err) {
				return callback(/* purposely not returning error */);
			}
			return callback();
		});		
	}


	var Instance = function () {
		var self = this;

		self._bootedPrograms = {};

		// TODO: Register this more centrally.
		process.on('SIGINT', function() {
			return self.killAll();
		});	
		process.on('SIGTERM', function() {
			return self.killAll();
		});
	}
	Instance.prototype.killAll = function () {
		var self = this;
		for (var programNumber in self._bootedPrograms) {
			self._bootedPrograms[programNumber].kill();
		}
		// TODO: Find a more deterministic way to wait by looking for `GOODBYE` log message?
		return setTimeout(function () {
	        console.log(("Quitting.").magenta);
	        process.stdin.end();
	        return process.exit(0);
		}, 1000);
	}
	Instance.prototype.hookAPI = function (API) {
		var self = this;

		API.runProgramProcess = function (options, callback) {
			options.number = Object.keys(self._bootedPrograms).length + 1;
			var program = new Program (this, options);
			self._bootedPrograms[program.number] = program;
			return program.start(function (err) {
				if (err) return callback(err);
				self.writeHeader();
				return callback(null, program);
			});
		}

	}
	Instance.prototype.writeHeader = function () {
		var self = this;
		console.log(("Enter '<ProgramNumber> + [Return]' to restart program or 'q + [Return]' to quit:").cyan);
		if (Object.keys(self._bootedPrograms).length === 0) {
			console.log(("  (No programs registered)").cyan);
			return;
		}
		Object.keys(self._bootedPrograms).forEach(function (programNumber) {
			console.log(("  " + (""+programNumber).bold + " - " + self._bootedPrograms[programNumber].label).cyan);
		});
	}
	Instance.prototype.runREPL = function (callback) {
		var self = this;
		process.stdin.resume();
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", function (data) {
			data = data.replace(/\n+/g, "");

			if (!data) {
				return self.writeHeader();
			}

			if (data === "q") {
				return self.killAll();
			}

			for (var programNumber in self._bootedPrograms) {
				if (programNumber == data) {

			        console.log(("Restarting program: " + self._bootedPrograms[programNumber].label).magenta);

			        return self._bootedPrograms[programNumber].kill(function (err) {
			        	if (err) {
			        		console.error("Error killing program! We may have orphans now!", err.stack);
			        	}
				        return setTimeout(function () {
					        return self._bootedPrograms[programNumber].start(function (err) {
					        	if (err) {
					        		console.error("Error starting program!", err.stack);
					        	}
					        	return self.writeHeader();
					        });
				        }, 1000);
			        });
				}
			}

			console.log(("Program with number '" + data + "' not found!").red);
			return;
		});
		return callback();
	}


	var Program = function (API, options) {
		var self = this;

		self.label = options.label;

		API.console.debug("Run program '" + self.label + "':", API.getTargetPath(), "using config:", options.config);

		self.number = options.number;
		self.process = null;

		self.startupPIDs = {};
		self.startupInterval = null;

		self.indexPIDs = function (callback) {
			if (!callback) {
				callback = function (err) {
					return;
				}
			}
			return getProcesses(function (err, processes) {
				if (err) return callback(err);
				var pids = [];
				if (self.process.pid) {
					pids.push(self.process.pid);
					function traverse (node) {
						if (
							node &&
							node.children &&
							node.children.length > 0
						) {
							node.children.forEach(function (pid) {
								pids.push(pid);
								return traverse(processes.byPid[""+pid]);
							});
						}
					}
					traverse(processes.byPid[""+self.process.pid]);
				}
				pids.reverse();
				if (self.startupPIDs) {
					pids.forEach(function (pid) {
						self.startupPIDs[pid] = true;
					});
				}
				return callback(null, pids);
			});
		};

		self.kill = function (callback) {
			if (!callback) {
				callback = function (err) {
					return;
				}
			}
			console.log(("Killing program '" + self.label + "'").magenta);
			return self.indexPIDs(function (err, pids) {
				if (err) return callback(err);
				if (pids.length === 0) {
					return callback(null);
				}
				return killPIDs(pids, callback);
			});
		};

		self.start = function (_callback) {

			if (!_callback) {
				_callback = function (err) {
			    	return;
				}
			}

			var callback = function (err) {
				if (err) {
					var pids = Object.keys(self.startupPIDs);
					if (pids.length === 0) {
						return _callback(err);
					}
					return killPIDs(pids, function () {
						return _callback(err);
					});
				}
				clearInterval(self.startupInterval);
				self.startupInterval = null;
				self.startupPIDs = null;
				return _callback(err);
			}

			try {

				var env = {};
				for (var name in process.env) {
					env[name] = process.env[name];
				}

				var declaringDescriptor = API.programDescriptor;

//console.log("declaringDescriptor", declaringDescriptor);
				if (declaringDescriptor) {
					if (declaringDescriptor.env) {
						for (var name in declaringDescriptor.env) {
							env[name] = declaringDescriptor.env[name];
						}
					}

					function waitUntilAlive () {
						if (
							!declaringDescriptor.routes ||
							!declaringDescriptor.routes.alive
						) {
							return callback(null);
						}

						var url = "http://127.0.0.1:" + env.PORT + declaringDescriptor.routes.alive.uri;

						console.log(("Waiting until program '" + self.label + "' is alive by checking route '" + url + "' against '" + JSON.stringify(declaringDescriptor.routes.alive.expect) + "'.").magenta);

						function checkAgain () {
							setTimeout(function () {
								doCheck();
							}, 1000);
						}

						function doCheck () {
							return API.REQUEST({
								method: "GET",
								url: url
							}, function (err, response, body) {
								if (err) {
									return checkAgain();
								}
								for (var name in declaringDescriptor.routes.alive.expect) {
									if (response[name] !== declaringDescriptor.routes.alive.expect[name]) {
										return checkAgain();
									}
								}
								console.log(("Done starting program '" + self.label + "'!").magenta);
								return callback(null);
							});
						}

						return doCheck();
					}
				}

				if (options.env) {
					for (name in options.env) {
						env[name] = options.env[name];
					}
				}


				var programConfigPath = API.PATH.join(API.getTargetPath(), "program.json");
				API.FS.outputFileSync(programConfigPath, JSON.stringify({
					"boot": {
						"config": options.bootConfigId || null,
						"package": API.PATH.join(options.cwd, "package.json")
					},
					"config": options.config || {}
				}, null, 4), "utf8");
				env.PINF_PROGRAM_PATH = programConfigPath;


				// Return when no message comes in within one second as we assume server setup is done.
				// i.e. For a server to stop us from proceeding it should issue a "." every 1/2 a second
				//      which doubles as a good responsiveness heartbeat.
				var lastMessageTime = null;
				var lastMessageTimeout = null;
				function onNewMessage () {
					lastMessageTime = Date.now();
					if (!lastMessageTimeout) {
						function makeTimeout () {
							lastMessageTimeout = setTimeout(function () {
								var offset = (Date.now() - 1000) - lastMessageTime;
								if (offset < 0) {
									return makeTimeout();
								}
								console.log(("Done booting program '" + self.label + "'.").magenta);
								return waitUntilAlive();
							}, 1000);
						}
						return makeTimeout();
					}
				}

			    var commands = options.commands;
			    if (Array.isArray(commands)) {
			    	commands = commands.join("\n");
			    }

				API.console.debug("Run commands:", commands, {
            		cwd: options.cwd,
            		env: env
            	});
			    self.process = API.SPAWN("bash", [
			        "-s"
			    ], {
			    	cwd: options.cwd,
			    	env: env
			    });
			    // TODO: Buffer calls to console and prefix and flush periodically so we
			    //       don't prefix partial written lines.
			    function prefixAndWrite (stream, prefixColor, lines) {
			    	lines = lines.toString().replace(/\n+/g, "\n").replace(/\n$/, "");
			    	if (!lines) return;
			    	var prefix = ("[" + self.number + ":" + self.label + "] ").bold;
			    	if (prefixColor) {
			    		prefix = prefix[prefixColor];
			    	}
			    	stream.write(prefix + lines.split("\n").join("\n" + prefix) + "\n");
			    	// TODO: Make these error lookup strings configurable.
			    	if (
			    		/Error: Cannot find module/.test(lines) ||
			    		/ERR!/.test(lines)
			    	) {
			    		if (!prefixAndWrite._error) {
			    			self.indexPIDs();
					    	prefixAndWrite._error = true;
					    	return setTimeout(function () {
					    		return callback(new Error("Detected an error in program output!"));
					    	}, 250);
			    		}
			    	}
			    }
			    self.process.on("error", function(err) {
			    	process.stdout.write(("[" + self.number + ":" + self.label + "] ERROR[1]: ").bold + (""+err.stack).red);
			    	return callback(err);
			    });
			    self.process.stdout.on("data", function (data) {
			    	onNewMessage();
			    	prefixAndWrite(process.stdout, null, data);
			    });
			    self.process.stderr.on("data", function (data) {
			    	onNewMessage();
			    	prefixAndWrite(process.stdout, "red", data);
			    });

			    self.startupInterval = setInterval(function () {
			    	self.indexPIDs();
			    }, 900);

			    self.process.stdin.write(commands);
			    self.process.stdin.end();

			} catch (err) {
		    	process.stdout.write(("[" + self.number + ":" + self.label + "] ERROR[2]: ").bold + (""+err.stack).red);
				return callback(err);
			}
		};
	}


	var Spinner = function () {
		this._turnIndex = 0;
	}
	Spinner.prototype = Object.create(API.EVENTS.EventEmitter.prototype);
	Spinner.prototype.turn = function () {
		var self = this;
		self._turnIndex += 1;
		API.console.verbose("Trigger turn: " + self._turnIndex);
		self.emit("turn", {
			index: self._turnIndex
		});
	}
	Spinner.prototype.spin = function () {
		var self = this;

		function monitor () {


			// TODO: Standardize this.
			var newInstance = null;
			if (!API.SINGLETONS["github.com/pinf-to/to.pinf.lib/0"]) {
				newInstance = new Instance();
				API.SINGLETONS["github.com/pinf-to/to.pinf.lib/0"] = newInstance;
			}

			API.SINGLETONS["github.com/pinf-to/to.pinf.lib/0"].hookAPI(API);

			if (newInstance) {

				newInstance.runREPL(function (err) {
					if (err) {
						console.error("Error running REPL: " + err.stack);
						return;
					}
				});

				API.notifyNoExitOnEnd();
			}

			return API.Q.resolve();


/*
			var intervalId = setInterval(function () {

				self.turn();

				if (self._turnIndex === 3) {
					return clearInterval(intervalId);
				}

			}, 1 * 1000);
			return intervalId;
*/
		}

		// Activate file watching.
//		function pinfIT () {
//			return API.pinfIT();
//		}

//		return pinfIT().then(function () {

			return monitor();
//		});
	}

	var spinner = new Spinner();

	API.on("request:turn", function (changed) {
		spinner.emit("turn", changed);
	});

	return spinner;
}

