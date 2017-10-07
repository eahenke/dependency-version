#! /usr/bin/env node

require('console.table');
const fetch = require('isomorphic-fetch');

//CLI Args
const ACCOUNT = getAccountArg();
const DEPENDENCY = getDependencyArg();
const OPTIONS = parseOptionArguments();

console.log(OPTIONS);

/* Main */
checkRequiredOptions(OPTIONS);

getUserRepos().then(res =>
{
	return getPackages(res);
}).then(res =>
{
	const output = getDependencies(DEPENDENCY, res.successes);
	formatOutput(output);
	formatErrors(res.errors);
}).catch(exitError);
/* End Main */



/* ARG PARSING */

//Args in -name=value pattern
function parseOptionArguments()
{
	return process.argv.slice(4).reduce((opts, arg) =>
	{
		if (arg[0] !== '-' || arg.indexOf('=') < 0) return opts;
		const argComponents = arg.split('=');
		let argVal = argComponents[1];
		if (argVal === 'false') argVal = false;
		opts[argComponents[0].substring(1)] = argVal;
		return opts;
	},
	{});
}

function getAccountArg()
{
	if (!process.argv[2]) exitError('User/Org argument is required as first arg');
	return process.argv[2];
}

function getDependencyArg()
{
	if (!process.argv[3]) exitError('Dependency argument is required as second arg');
	return process.argv[3];
}

function checkRequiredOptions(options)
{
	const required = ['user', 'token'];
	const missingOpts = required.filter(r =>
	{
		return (!options.hasOwnProperty(r));
	});
	if (missingOpts && missingOpts.length)
	{
		const verb = missingOpts.length > 1 ? 'are' : 'is';
		return exitError(`Argument ${missingOpts.join(', ')} ${verb} required`);
	}
}

/* Formatting */
function formatErrors(errors)
{
	var formattedErrors = errors.filter(e =>
	{
		return e.message !== 'Not Found' && e.message !== 'This repository is empty.';
	}).map(e =>
	{
		return {
			repo: e.repoName,
			error: e.message
		};
	});
	if (!formattedErrors || !formattedErrors.length) return;
	console.log('\nUnable to retrieve information for following repos\n');
	console.table(formattedErrors);
}

function formatOutput(output)
{
	if (!output || !Object.keys(output).length)
	{
		console.log(`\nNo ${ACCOUNT} repos found dependent on ${DEPENDENCY}\n`);
		return;
	}

	var formattedOutput = Object.keys(output).map(repo =>
	{
		return {
			repo: repo,
			'dependency version': output[repo],
		};
	});
	console.log(`\nResults for ${ACCOUNT} repos dependent on ${DEPENDENCY}\n`);
	console.table(formattedOutput);
}

/* GITHUB */

function getUserRepos()
{
	const path = 'https://api.github.com';
	const type = OPTIONS.org ? 'orgs' : 'users';
	return request(
	{
		uri: `${path}/${type}/${ACCOUNT}/repos?per_page=100`,
	});
}

function requestPackage(repo)
{
	let path = `https://api.github.com/repos/${ACCOUNT}/${repo.name}/contents/package.json`;
	if (OPTIONS.branch && OPTIONS.branch.length) path += `?branch='${OPTIONS.branch}`;
	return request(
	{
		uri: path,
	});
}

function getPackages(repos)
{
	const errors = [];
	const successes = [];

	return reflect(repos.map(r =>
	{
		return requestPackage(r).then(res =>
		{
			return {
				repoName: r.name,
				data: res
			};
		}).catch(e =>
		{
			e.repoName = r.name;
			throw e;
		});
	})).then(results =>
	{
		results.forEach(r =>
		{
			if (r.isFulfilled) successes.push(r.result);
			else errors.push(r.error);
		});
		return {
			successes,
			errors
		};
	});
}

//Decode dependency content and create output object
function getDependencies(dependency, packages)
{
	const output = packages.reduce((obj, pack) =>
	{
		if (!pack.data || !pack.data.content) return obj;
		const content = decode(pack.data.content);
		if (!content.dependencies && !content.devDependencies) return obj;
		if (content.dependencies && content.dependencies[dependency])
		{
			obj[pack.repoName] = content.dependencies[dependency];
		}
		if (content.devDependencies && content.devDependencies[dependency])
		{
			obj[pack.repoName] = content.devDependencies[dependency];
		}
		return obj;
	},
	{});
	return output;
}

//Decode base64
function decode(content)
{
	const buff = Buffer.from(content, 'base64');
	return JSON.parse(buff.toString('utf8'));
}


/* HTTP */

function request(options)
{
	let uri = options.uri;
	uri += (uri.indexOf("?") === -1 ? "?" : "&") + "access_token=" + encodeURIComponent(OPTIONS.token);

	return fetch(uri,
	{
		method: options.method || 'GET',
		headers:
		{
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': OPTIONS.user,
		},
	}).then(requestErrorHandler);
}


//Check status, return if ok, throw otherwise
function requestErrorHandler(response)
{
	if (response.ok && response.status === 204) return response;
	if (response.ok) return response.json();
	return response.json().then(e =>
	{
		if (e.error) e = e.error;
		throw e;
	});
}

/* UTILITIES */

function exitError(error)
{
	console.log(error);
	console.log(error.stack);
	console.error(`Error: ${error.message}`);
	process.exit(1);
}

function reflect(promises)
{
	return Promise.all(promises.map(promise =>
	{
		return promise.then(res =>
		{
			return {
				result: res,
				isFulfilled: true
			};
		}).catch(e =>
		{
			return {
				result: null,
				isFulfilled: false,
				error: e
			};
		});
	}));
}