const cashless = require('./../cashless.js');
const ethers = require("ethers");

var bufferToHex = (buffer) => {
    let result = [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"))
        .join ("");
    return "0x"+result
}

(async () => {
    try {
        let args = process.argv;
        let providerURL = args[2];
        let privateKey = args[3];
        let wallet = cashless.wallet(providerURL, privateKey);
        let claimData = Buffer.from(args[4].substring(2), 'hex');
        let cashlessContract = cashless.contract(providerURL, wallet);
        let cashlessLibContract = cashless.libContract(providerURL);
        console.log("got here!");
        let hash = await cashless.getClaimHash(cashlessContract, cashlessLibContract, claimData);
        console.log("and here!");
        console.log(hash);
        let rawSig = await wallet.signMessage(hash);
        let res = ethers.utils.splitSignature(rawSig);
        let sig = {v: res.v, r: res.r, s: res.s};
        res = await cashless.signClaim(cashlessContract, cashlessLibContract, claimData);
        let sig2 = {v: res.v, r: bufferToHex(res.r), s: bufferToHex(res.s)};
        console.log("signature1:", JSON.stringify(sig));
        console.log("signature check:", JSON.stringify(sig2));
    } catch(e) {
        console.log(e.message);
    }
})();