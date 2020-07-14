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
	let name = cashless.hashString(args[5]);
	let res = await cashless.issuePendingAlias(providerURL, privateKey, cashlessAddress, name, './../build/contracts/');
	console.log("raw alias (sha256 hashed name):", bufferToHex(name));
})();