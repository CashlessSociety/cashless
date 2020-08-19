const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let claimData = Buffer.from(args[3].substring(2), 'hex');
	let rawSig = JSON.parse(args[4]);
	let isSender = false;
	if (args[5]=="sender") {
		isSender = true;
	}
	let contract = cashless.contract(providerURL, null);
	let sig = {v: rawSig["v"], r: Buffer.from(rawSig["r"].substring(2), 'hex'), s: Buffer.from(rawSig["s"].substring(2), "hex")};
	let res = await cashless.verifyClaimSig(contract, claimData, sig, isSender);
	console.log(res);
})();