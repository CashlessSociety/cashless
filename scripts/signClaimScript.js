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
	let cashlessLibAddress = cashless.getCashlessLibAddress(network);
	let claimData = Buffer.from(args[5].substring(2), 'hex');
	let res = await cashless.signClaim(providerURL, privateKey, cashlessAddress, cashlessLibAddress, claimData, './../build/contracts/');
	let sig = {v: res.v, r: bufferToHex(res.r), s: bufferToHex(res.s)};
	console.log("signature:", JSON.stringify(sig));
})();