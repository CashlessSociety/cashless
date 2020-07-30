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
	let reservesAddress = args[5];
	let rawSig = JSON.parse(args[6]);
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let contract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, privateKey);
	let sig = {v: rawSig["v"], r: Buffer.from(rawSig["r"].substring(2), 'hex'), s: Buffer.from(rawSig["s"].substring(2), "hex")};
	let res = await cashless.initReservesTx(contract, reservesAddress, sig);
})();