const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let amountEth = args[4];
	let contract = cashless.contract(providerURL, privateKey);
	let res = await cashless.fundReservesTx(contract, amountEth);
})();