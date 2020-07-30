const cashless = require('./../cashless.js');
const ethers = require('ethers');

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
	let reservesAddress = args[4];
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let contract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, null);
	let resp = await cashless.getReserves(contract, reservesAddress);
	let readable = {balance: (resp["balance"]/ethers.utils.parseEther("1")).toString(), grossClaimed: (resp["grossClaimed"]/ethers.utils.parseEther("1")).toString(), grossDefaulted: (resp["grossDefaulted"]/ethers.utils.parseEther("1")).toString(), grossPaid: (resp["grossPaid"]/ethers.utils.parseEther("1")).toString()};
	console.log("reserves info:", JSON.stringify(readable));
})();