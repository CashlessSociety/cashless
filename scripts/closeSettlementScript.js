const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let accountOwner = args[4];
	let claimID = args[5];
	let contract = cashless.contract(providerURL, privateKey);
	let res = await cashless.closeSettlementTx(contract, accountOwner, claimID);
})();