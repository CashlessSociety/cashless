const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let network = args[2];
	let providerURL;
	if (network == "mainnet" || network == "ropsten") {
		let apiKey = args[3];
		providerURL = "https://"+network+".infura.io/v3/"+apiKey;
	} else {
		let port = args[3];
		providerURL = "http://127.0.0.1:"+port;
	}
	let privateKey = args[4];
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessLibAddress = cashless.getCashlessLibAddress(network);
	let sig = await cashless.signInitReserves(providerURL, privateKey, cashlessAddress, cashlessLibAddress, './../build/contracts/');
	let reservesAddress = cashless.addressFromPriv(providerURL, privateKey);
	let res = await cashless.initReserves(providerURL, privateKey, cashlessAddress, reservesAddress, sig, './../build/contracts/');
})();