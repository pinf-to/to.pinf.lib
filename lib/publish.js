
exports.for = function (module, publisher) {

	console.log("DEPRECATED: to.pinf.lib/lib/publish.js; use 'pto turn' instead");

/*
		if (process.env.npm_config_argv) {
			if (JSON.parse(process.env.npm_config_argv).original.indexOf("--ignore-dirty") !== -1) {
				exitOnDirty = false;
			}
		} else
		if (process.argv.indexOf("--ignore-dirty") !== -1) {
			exitOnDirty = false;
		}
*/		

	exitOnDirty = false;
	return API.runCommands([
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

		var gitBranch = stdout.match(/Publishing from branch:\s([^\n]+)\n/);
		if (gitBranch) {
			gitBranch = gitBranch[1];
		} else {
			gitBranch = "NA";
		}

		API.getGitBranch = function () {
			return gitBranch;
		};

		function onError (err) {
			return API.runCommands([
				'git checkout ' + gitBranch
			], function () {
				return callback(err);
			});
		}

		try {
			return publisher(API, function (err) {
				if (err) return onError(err);
				return callback();
			});
		} catch(err) {
			return onError(err);
		}
	});
}
