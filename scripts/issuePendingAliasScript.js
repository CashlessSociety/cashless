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
	let cashlessAddress = cashless.getCashlessAddress(network);
	let name = cashless.hashString(args[5]);
	let res = await cashless.issuePendingAlias(providerURL, privateKey, cashlessAddress, name, './../build/contracts/');
	console.log("raw alias (sha256 hashed name):", bufferToHex(name));
})();