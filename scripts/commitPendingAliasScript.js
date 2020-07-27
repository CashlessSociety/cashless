const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv
	let network = args[2];
	let providerURL;
	if (network == "mainnet" || network == "ropsten") {
		let apiKey = args[3];
		providerURL = "https://"+network+".infura.io/v3/"+apiKey;
	} else {
		let port = args[3];
		providerURL = "http://127.0.0.1:"+port;
	}
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let privateKey = args[4];
	let cashlessAddress = cashless.getCashlessAddress(network);
	let name = cashless.hashString(args[5]);
	let chosenAddress = args[6];
	let res = await cashless.commitPendingAlias(providerURL, privateKey, cashlessAddress, name, chosenAddress, './../build/contracts/');
})();