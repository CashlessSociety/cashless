const ethers = require('ethers');
const fs = require('fs');
const cashless = require('./../cashless.js');
const crypto = require('crypto');

hashString = str => {
	let hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

(async () => {
	let args = process.argv;
	let name = hashString(args[5]);
	let res = await cashless.issuePendingAlias(args[2], args[3], args[4], name, './../build/contracts/');
	console.log("raw alias (hashed name):", name);
})();