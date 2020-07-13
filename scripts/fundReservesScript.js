const ethers = require('ethers');
const fs = require('fs');
const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let res = await cashless.fundReserves(args[2], args[3], args[4], args[5], './../build/contracts/');
})();