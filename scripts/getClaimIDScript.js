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
	let claimData = Buffer.from(args[3].substring(2), 'hex');
	let claim = cashless.decodeClaim(claimData);
	let cashlessLibContract = cashless.libContract(providerURL);
	let senderAddress = "0x"+claim[1][0];
	let receiverAddress = "0x"+claim[1][1];
	let claimName = bufferToHex(claim[2][0]);
	let resp = await cashless.getClaimID(cashlessLibContract, claimName, senderAddress, receiverAddress);
	console.log("claim ID:", resp);
})();