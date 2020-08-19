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
	let name = args[4];
	let contract = cashless.contract(providerURL, privateKey);
	let alias = cashless.hashString(name);
	let res = await cashless.issueAliasTx(contract, alias);
	console.log("raw alias (sha256 hashed name):", bufferToHex(alias));
})();