const cashless = require('./../cashless.js');

var bufferToHex = (buffer) => {
    let result = [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
    return "0x"+result

}

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
	let name = args[5];
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let contract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, privateKey);
	let alias = cashless.hashString(name);
	let res = await cashless.issuePendingAliasTx(contract, alias);
	console.log("raw alias (sha256 hashed name):", bufferToHex(alias));
})();