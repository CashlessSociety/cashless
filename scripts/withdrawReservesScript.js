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
	let amountEth = args[5];
	let recvAddress = cashless.addressFromPriv(providerURL, privateKey)
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let contract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, privateKey);
	let tipAmount = ((Number(amountEth)/100)+0.00000000002).toString();
	let amount = (Number(amountEth) - Number(tipAmount)).toString();
	let res = await cashless.withdrawReservesTx(contract, amount, recvAddress, tipAmount);
})();