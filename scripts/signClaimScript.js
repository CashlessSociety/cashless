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
	let cashlessAddress = args[4];
	let cashlessLibAddress = args[5];
	let claimData = Buffer.from(args[6].substring(2), 'hex');
	let res = await cashless.signClaim(providerURL, privateKey, cashlessAddress, cashlessLibAddress, claimData, './../build/contracts/');
	let sig = {v: res.v, r: bufferToHex(res.r), s: bufferToHex(res.s)};
	console.log("signature:", JSON.stringify(sig));
})();