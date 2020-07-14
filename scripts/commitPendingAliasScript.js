const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessAddress = args[4];
	let name = cashless.hashString(args[5]);
	let chosenAddress = args[6];
	let res = await cashless.commitPendingAlias(providerURL, privateKey, cashlessAddress, name, chosenAddress, './../build/contracts/');
})();