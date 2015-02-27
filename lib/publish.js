
exports.for = function (module, publisher) {

	return require("./common").for(module, function (API, callback) {

		API.GULP = require("gulp");
		API.GULP_REPLACE = require("gulp-replace");
		API.GULP_FILTER = require("gulp-filter");
		API.GULP_RENAME = require("gulp-rename");

		var exitOnDirty = true;
		if (process.env.npm_config_argv) {
			if (JSON.parse(process.env.npm_config_argv).original.indexOf("--ignore-dirty") !== -1) {
				exitOnDirty = false;
			}
		} else
		if (process.argv.indexOf("--ignore-dirty") !== -1) {
			exitOnDirty = false;
		}
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

			var gitBranch = stdout.match(/Publishing from branch:\s([^\n]+)\n/)[1];

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
	});
}
