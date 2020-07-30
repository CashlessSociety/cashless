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
	let claimData = Buffer.from(args[5].substring(2), 'hex');
	let cashlessAddress = cashless.getCashlessAddress(network);
	let cashlessABI = cashless.getCashlessContractABI('./../build/contracts/');
	let cashlessContract = cashless.getContract(providerURL, cashlessAddress, cashlessABI, privateKey);
	let cashlessLibAddress = cashless.getCashlessLibAddress(network);
	let cashlessLibABI = cashless.getCashlessLibContractABI('./../build/contracts/');
	let cashlessLibContract = cashless.getContract(providerURL, cashlessLibAddress, cashlessLibABI, null);
	let res = await cashless.signClaim(privateKey, cashlessContract, cashlessLibContract, claimData);
	let sig = {v: res.v, r: bufferToHex(res.r), s: bufferToHex(res.s)};
	console.log("signature:", JSON.stringify(sig));
})();