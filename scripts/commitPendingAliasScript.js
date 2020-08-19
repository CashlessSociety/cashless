const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv
	let providerURL = args[2];
	let privateKey = args[3];
	let name = args[4];
	let alias = cashless.hashString(name);
	let chosenAddress = args[5];
	let contract = cashless.contract(providerURL, privateKey);
	let res = await cashless.commitPendingAliasTx(contract, alias, chosenAddress);
})();