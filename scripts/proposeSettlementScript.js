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
	let claimData = Buffer.from(args[5].substring(2), 'hex');
	let rawSig1 = JSON.parse(args[6]);
	let sig1 = {v: rawSig1["v"], r: Buffer.from(rawSig1["r"].substring(2), 'hex'), s: Buffer.from(rawSig1["s"].substring(2), "hex")};
	let rawSig2 = JSON.parse(args[7]);
	let sig2 = {v: rawSig2["v"], r: Buffer.from(rawSig2["r"].substring(2), 'hex'), s: Buffer.from(rawSig2["s"].substring(2), "hex")};
	let res = await cashless.proposeSettlement(providerURL, privateKey, cashlessAddress, claimData, sig1, sig2, './../build/contracts/');
})();