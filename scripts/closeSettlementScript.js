const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let claimID = args[4];
	let contract = cashless.contract(providerURL, privateKey);
	let res = await cashless.closeSettlementTx(contract, cashless.addressFromPriv(privateKey), claimID);
})();