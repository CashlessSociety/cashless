const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessAddress = args[4];
	let amountEth = args[5];
	let res = await cashless.fundReserves(providerURL, privateKey, cashlessAddress, amountEth, './../build/contracts/');
})();