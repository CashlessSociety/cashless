const ethers = require('ethers');
const fs = require('fs');
const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let claimData = Buffer.from(args[6], 'hex');
	let res = await cashless.signClaim(args[2], args[3], args[4], args[5], claimData, './../build/contracts/');
	console.log(JSON.stringify(res));
})();