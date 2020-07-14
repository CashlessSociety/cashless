const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let cashlessAddress = args[4];
	let reservesAddress = args[5];
	let rawSig = JSON.parse(args[6]);
	let sig = {v: rawSig["v"], r: Buffer.from(rawSig["r"].substring(2), 'hex'), s: Buffer.from(rawSig["s"].substring(2), "hex")};
	let res = await cashless.initReserves(providerURL, privateKey, cashlessAddress, reservesAddress, sig, './../build/contracts/');
})();