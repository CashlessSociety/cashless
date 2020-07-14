const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessAddress = args[4];
	let claimData = Buffer.from(args[5].substring(2), 'hex');
	let rawSig1 = JSON.parse(args[6]);
	let sig1 = {v: rawSig1["v"], r: Buffer.from(rawSig1["r"].substring(2), 'hex'), s: Buffer.from(rawSig1["s"].substring(2), "hex")};
	let rawSig2 = JSON.parse(args[7]);
	let sig2 = {v: rawSig2["v"], r: Buffer.from(rawSig2["r"].substring(2), 'hex'), s: Buffer.from(rawSig2["s"].substring(2), "hex")};
	let res = await cashless.proposeSettlement(providerURL, privateKey, cashlessAddress, claimData, sig1, sig2, './../build/contracts/');
})();