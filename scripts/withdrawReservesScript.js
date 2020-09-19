const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let amount = args[4];
	let recvAddress = cashless.addressFromPriv(privateKey);
	let contract = cashless.contract(providerURL, privateKey);
	let res = await cashless.withdrawReservesTx(contract, amount, recvAddress);
})();