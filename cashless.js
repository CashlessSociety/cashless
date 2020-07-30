const ethers = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const ethjsutil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');

const ecsign = ethjsutil.ecsign;

exports.hashString = str => {
	let hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

exports.getCashlessAddress = network => {
	if (network == "mainnet") {
		return "0x9c30cC03246443D6c9e211c298bBd94Ef889151E";
	}
	if (network == "ropsten") {
		return "0xee0Ef6Bc446c4756E5164Ac6659F4c6D07A2A7BF";
	}
	if (network == "dev") {
		return "0xd4177a2bd990da8416f30c1d9a161cb2c9325f8b";
	}
	console.log("error: unrecognized network:", network);
}

exports.getCashlessLibAddress = network => {
	if (network == "mainnet") {
		return "0xa3c93Ea516d2c9f39901f7C4379b3b3a4B281aB8";
	}
	if (network == "ropsten") {
		return "0x10E27c27ba5c5f7c25f5BD24dB9c27Da3390dA85";
	}
	if (network == "dev") {
		return "0xb3869548879977c80564f0a42ff934f0cef4bbc7";
	}
	console.log("error: unrecognized network:", network);
}

exports.getCashlessContractABI = contractDir => {
	let c = JSON.parse(fs.readFileSync(contractDir+'Cashless.json'));
	return c["abi"];	
}

exports.getCashlessLibContractABI = contractDir => {
	let lib = JSON.parse(fs.readFileSync(contractDir+'CashlessLibPub.json'));
	return lib["abi"];
}

exports.getContract = (providerURL, contractAddress, contractABI, privateKey) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let contract = new ethers.Contract(contractAddress, contractABI, provider);
	if (privateKey != null) {
		let wallet = new ethers.Wallet(privateKey, provider);
		contract = contract.connect(wallet);
	}

	return contract;
}

exports.addressFromPriv = (providerURL, privateKey) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	return wallet.address;
}

exports.encodeClaim = (amountEth, disputeDuration, vestTimestamp, voidTimestamp, senderAddress, receiverAddress, claimName, receiverAlias, loopID, nonce) => {
	return abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther(amountEth).toString(), disputeDuration, vestTimestamp, voidTimestamp], [senderAddress, receiverAddress], [claimName, receiverAlias, loopID], nonce]);
}

exports.decodeClaim = (claimData) => {
	return abi.rawDecode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], claimData);
}

exports.encodeLoopClaim = async (cashlessLib, claimData, sig1, sig2) => {
	try {
		let data = await cashlessLib.encodeLoopClaim(claimData, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s]);
		return data;
	} catch(e) {
		console.log("error encoding loop claim:", e.message);
		return
	}
}

exports.getLoopID = async (cashlessLib, loopName, addresses) => {
	try {
		let data = await cashlessLib.functions.getLoopID(loopName, addresses);
		return data[0];
	} catch(e) {
		console.log("error encoding loop claim:", e.message);
		return
	} 
}

exports.signClaim = async (privateKey, cashless, cashlessLib, claimData) => {
	try {
		let ds = await cashless.functions.DOMAIN_SEPARATOR();
		ds = ds[0];
		let h = await cashlessLib.functions.hashClaimData(claimData, ds);
		h = h[0].substring(2);
		let bh = Uint8Array.from(Buffer.from(h, 'hex'));
		let priv = Uint8Array.from(Buffer.from(privateKey.substring(2), 'hex'));
		return ecsign(bh, priv);		
	} catch(e) {
		console.log("error signing claim:", e.message);
		return
	}
}

exports.signInitReserves = async (privateKey, cashless, cashlessLib, address) => {
	try {
		let ds = await cashless.functions.DOMAIN_SEPARATOR();
		ds = ds[0];
		let data = abi.rawEncode(["address"], [address]);
		let h = await cashlessLib.functions.hashClaimData(data, ds);
		h = h[0].substring(2);
		let bh = Uint8Array.from(Buffer.from(h, 'hex'));
		let priv = Uint8Array.from(Buffer.from(privateKey.substring(2), 'hex'));
		return ecsign(bh, priv);
	} catch(e) {
		console.log("error signing init reserves:", e.message);
		return		
	}
}

exports.getReserves = async (cashless, address) => {
	try {
		return await cashless.functions.reserves(address);
	} catch(e) {
		console.log("error getting reserves:", e.message);
		return
	}
}

exports.initReservesTx = async (cashless, address, sig) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.createReserves(address, sig.v, sig.r, sig.s, options);
		console.log("new reserves tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log('error creating reserves:', e.message);
		return 
	}
}

exports.fundReservesTx = async (cashless, reservesAddress, amountEth) => {
	let options = {value: ethers.utils.parseEther(amountEth), gasLimit: 50000};
	try {
		let tx = await cashless.functions.fundReserves(reservesAddress, options);
		console.log("fund tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log('error funding reserves:', e.message);
		return
	}
}

exports.withdrawReservesTx = async (cashless, amountEth, receiverAddress, tipAmountEth) => {
	let options = {gasLimit: 60000};
	try {
		let tx = await cashless.functions.withdrawReserves(ethers.utils.parseEther(amountEth), receiverAddress, ethers.utils.parseEther(tipAmountEth), options);
		console.log("withdraw tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log('error withdrawing reserves:', e.message);
		return
	}
}

exports.proposeSettlementTx = async (cashless, claimData, sig1, sig2) => {
	let options = {gasLimit: 800000};
	try{
		let tx = await cashless.functions.proposeSettlement(claimData, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s], options);
		console.log("settlement tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error proposing settlement:", e.message);
		return
	}
}

exports.proposeLoopTx = async (cashless, loopName, addresses, minFlowEth, lockTime) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.proposeLoop(loopName, addresses, ethers.utils.parseEther(minFlowEth), lockTime);
		console.log("loop proposal tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error proposing loop:", e.message);
		return		
	}
}

exports.commitLoopClaimTx = async (cashless, loopID, encodedClaim1, encodedClaim2) => {
	let options = {gasLimit: 1000000};
	try {
		let tx = await cashless.functions.commitLoopClaim(loopID, encodedClaim1, encodedClaim2, options);
		console.log("commit loop claim tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error committing loop claim:", e.message);
		return
	}
}

exports.issuePendingAliasTx = async (cashless, alias) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.addPendingAlias(alias, options);
		console.log("pending alias tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error issuing pending alias:", e.message);
		return
	}
}

exports.commitPendingAliasTx = async (cashless, alias, address) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.commitPendingAlias(alias, address, options);
		console.log("commit pending alias tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error committing pending alias:", e.message);
		return
	}
}