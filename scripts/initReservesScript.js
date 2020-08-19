const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessContract = cashless.contract(providerURL, privateKey);
	let cashlessLibContract = cashless.libContract(providerURL);
	let reservesAddress = cashless.addressFromPriv(privateKey);
	let sig = await cashless.signInitReserves(cashlessContract, cashlessLibContract);
	let res = await cashless.initReservesTx(cashlessContract, reservesAddress, sig);
})();