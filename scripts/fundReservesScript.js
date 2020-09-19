const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let amountToken = args[4];
    let contract = cashless.contract(providerURL, privateKey);
    let erc20 = cashless.erc20Contract(providerURL, privateKey);
	let res = await cashless.fundReservesTx(contract, erc20, amountToken);
})();