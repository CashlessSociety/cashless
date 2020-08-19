const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let amountEth = args[4];
	let recvAddress = cashless.addressFromPriv(privateKey);
	let contract = cashless.contract(providerURL, privateKey);
	let tipAmount = ((Number(amountEth)/100)+0.0001).toString();
	let amount = (Number(amountEth) - Number(tipAmount)).toString();
	let res = await cashless.withdrawReservesTx(contract, amount, recvAddress, tipAmount);
})();