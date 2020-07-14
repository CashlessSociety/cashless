const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessAddress = args[4];
	let cashlessLibAddress = args[5];
	let sig = await cashless.signInitReserves(providerURL, privateKey, cashlessAddress, cashlessLibAddress, './../build/contracts/');
	let reservesAddress = cashless.addressFromPriv(providerURL, privateKey);
	let res = await cashless.initReserves(providerURL, privateKey, cashlessAddress, reservesAddress, sig, './../build/contracts/');
})();