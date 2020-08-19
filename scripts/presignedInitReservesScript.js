const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let reservesAddress = args[4];
	let rawSig = JSON.parse(args[5]);
	let contract = cashless.contract(providerURL, privateKey);
	let sig = {v: rawSig["v"], r: Buffer.from(rawSig["r"].substring(2), 'hex'), s: Buffer.from(rawSig["s"].substring(2), "hex")};
	let res = await cashless.initReservesTx(contract, reservesAddress, sig);
})();