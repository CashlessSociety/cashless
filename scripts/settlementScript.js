const ethers = require('ethers');
const fs = require('fs');
const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let claimData = Buffer.from(args[5], 'hex');
	let sig1 = JSON.parse(args[6]);
	let sig2 = JSON.parse(args[7]);
	let res = await cashless.proposeSettlement(args[2], args[3], args[4], claimData, sig1, sig2, './../build/contracts/');
})();