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
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let cashlessContract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, privateKey);
	let cashlessLibAddress = cashless.getCashlessLibAddress(network);
	let cashlessLibABI = cashless.getCashlessLibContractABI('./../build/contracts/');
	let cashlessLibContract = cashless.getContract(providerURL, cashlessLibAddress, cashlessLibABI, null);
	let reservesAddress = cashless.addressFromPriv(providerURL, privateKey);
	let sig = await cashless.signInitReserves(privateKey, cashlessContract, cashlessLibContract, reservesAddress);
	let res = await cashless.initReservesTx(cashlessContract, reservesAddress, sig);
})();