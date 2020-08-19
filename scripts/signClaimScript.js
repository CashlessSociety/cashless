const cashless = require('./../cashless.js');

var bufferToHex = (buffer) => {
    let result = [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
    return "0x"+result

}

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
	let claimData = Buffer.from(args[4].substring(2), 'hex');
	let cashlessContract = cashless.contract(providerURL, privateKey);
	let cashlessLibContract = cashless.libContract(providerURL);
	let res = await cashless.signClaim(cashlessContract, cashlessLibContract, claimData);
	let sig = {v: res.v, r: bufferToHex(res.r), s: bufferToHex(res.s)};
	console.log("signature:", JSON.stringify(sig));
})();