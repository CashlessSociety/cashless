const cashless = require('./../cashless.js');
const ethers = require('ethers');

var bufferToHex = (buffer) => {
    let result = [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
    return "0x"+result

}

(() => {
	let args = process.argv;
	let claimData = Buffer.from(args[2].substring(2), 'hex');
	let claim = cashless.decodeClaim(claimData);
	let readableClaim = {amountEth: (claim[0][0]/ethers.utils.parseEther("1")).toString(), disputeDuration: Number(claim[0][1]), vestTimestamp: Number(claim[0][2]), voidTimestamp: Number(claim[0][3]), senderAddress: "0x"+claim[1][0], receiverAddress: "0x"+claim[1][1], claimName: bufferToHex(claim[2][0]), receiverAlias: bufferToHex(claim[2][1]), loopID: bufferToHex(claim[2][2]), nonce: claim[3]};
	console.log("claim:", JSON.stringify(readableClaim));
})();