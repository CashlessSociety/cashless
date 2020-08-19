const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let claimData = Buffer.from(args[4].substring(2), 'hex');
	let rawSig1 = JSON.parse(args[5]);
	let rawSig2 = JSON.parse(args[6]);
	let contract = cashless.contract(providerURL, privateKey);
	let sig1 = {v: rawSig1["v"], r: Buffer.from(rawSig1["r"].substring(2), 'hex'), s: Buffer.from(rawSig1["s"].substring(2), "hex")};
	let sig2 = {v: rawSig2["v"], r: Buffer.from(rawSig2["r"].substring(2), 'hex'), s: Buffer.from(rawSig2["s"].substring(2), "hex")};
	let res = await cashless.disputeSettlementTx(contract, claimData, sig1, sig2);
})();