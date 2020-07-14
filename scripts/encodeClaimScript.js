const cashless = require('./../cashless.js');

var bufferToHex = (buffer) => {
    let result = [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
    return "0x"+result

}

var encodeClaim = () => {
	let args = process.argv;
	let claimJSON = JSON.parse(args[2]);
	let result = cashless.encodeClaim(claimJSON["amountEth"], claimJSON["disputeDuration"], claimJSON["vestTimestamp"], claimJSON["voidTimestamp"], claimJSON["senderAddress"], claimJSON["receiverAddress"], claimJSON["claimName"], claimJSON["receiverAlias"], claimJSON["loopID"], claimJSON["nonce"]);
	console.log("claim:", bufferToHex(result));
}

encodeClaim();

