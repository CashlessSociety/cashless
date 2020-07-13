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

var getCashlessContract = (provider, address, contractPath) => {
	let c = JSON.parse(fs.readFileSync(contractPath+'Cashless.json'));
	let cashless = new ethers.Contract(address, c["abi"], provider);
	return cashless;
}

var getCashlessLibContract = (provider, address, contractPath) => {
	let lib = JSON.parse(fs.readFileSync(contractPath+'CashlessLibPub.json'));
	let cashlessLib = new ethers.Contract(address, lib["abi"], provider);
	return cashlessLib;
}

var initReservesTx = async (cashless, amountEth) => {
	let options = {value: ethers.utils.parseEther(amountEth), gasLimit: 90000};
	try {
		let tx = await cashless.functions.createReserves(options);
		console.log("new reserves tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log('error creating reserves:', e.message);
		return 
	}
}

var fundReservesTx = async (cashless, reservesAddress, amountEth) => {
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

var withdrawReservesTx = async (cashless, amountEth, receiverAddress, tipAmountEth) => {
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

var proposeSettlementTx = async (cashless, claimData, sig1, sig2) => {
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

var proposeLoopTx = async (cashless, loopName, addresses, minFlow, lockTime) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.proposeLoop(loopName, addresses, minFlow, lockTime);
		console.log("loop proposal tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error proposing loop:", e.message);
		return		
	}
}

var commitLoopClaimTx = async (cashless, loopID, encodedClaim1, encodedClaim2) => {
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

var issuePendingAliasTx = async (cashless, name) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.addPendingAlias(name, options);
		console.log("pending alias tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error issuing pending alias:", e.message);
		return
	}
}

var commitPendingAliasTx = async (cashless, name, address) => {
	let options = {gasLimit: 100000};
	try {
		let tx = await cashless.functions.commitPendingAlias(name, address, options);
		console.log("commit pending alias tx hash:", tx.hash);
		return tx.hash;
	} catch(e) {
		console.log("error committing pending alias:", e.message);
		return
	}
}

exports.encodeClaim = (amountEth, disputeDuration, vestTimestamp, voidTimestamp, senderAddress, receiverAddress, claimName, receiverAlias, loopID, nonce) => {
	return abi.rawEncode(["uint256[4]", "address[2]", "bytes32[3]", "uint8"], [[ethers.utils.parseEther(amountEth).toString(), disputeDuration, vestTimestamp, voidTimestamp], [senderAddress, receiverAddress], [claimName, receiverAlias, loopID], nonce]);
}

exports.encodeLoopClaim = async (providerURL, cashlessLibAddress, claimData, sig1, sig2, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let cashlessLib = getCashlessLibContract(provider, cashlessLibAddress, contractPath);
	try {
		let data = await cashlessLib.encodeLoopClaim(claimData, [sig1.v, sig2.v], [sig1.r, sig2.r], [sig1.s, sig2.s]);
		return data;
	} catch(e) {
		console.log("error encoding loop claim:", e.message);
		return
	}
}

exports.getLoopID = async (providerURL, cashlessLibAddress, loopName, addresses, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let cashlessLib = getCashlessLibContract(provider, cashlessLibAddress, contractPath);
	try {
		let data = await cashlessLib.functions.getLoopID(loopName, addresses);
		return data[0];
	} catch(e) {
		console.log("error encoding loop claim:", e.message);
		return
	} 
}

exports.signClaim = async (providerURL, privateKey, cashlessAddress, cashlessLibAddress, claimData, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL); 
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	let cashlessLib = getCashlessLibContract(provider, cashlessLibAddress, contractPath);
	let ds = await cashless.functions.DOMAIN_SEPARATOR();
	ds = ds[0];
	let h = await cashlessLib.functions.hashClaimData(claimData, ds);
	h = h[0].substring(2);
	let bh = Uint8Array.from(Buffer.from(h, 'hex'));
	let priv = Uint8Array.from(Buffer.from(privateKey.substring(2), 'hex'));
	return ecsign(bh, priv);
}

exports.fundReserves = async (providerURL, privateKey, cashlessAddress, amountEth, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await fundReservesTx(cashless, wallet.address, amountEth);
}

exports.initReserves = async (providerURL, privateKey, cashlessAddress, amountEth, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await initReservesTx(cashless, amountEth);
}

exports.withdrawReserves = async (providerURL, privateKey, cashlessAddress, amountEth, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	let tipAmount = ((Number(amountEth)/100)+0.00000000002).toString();
	let amount = (Number(amountEth) - Number(tipAmount)).toString();
	return await withdrawReservesTx(cashless, amount, wallet.address, tipAmount);
}

exports.issuePendingAlias = async (providerURL, privateKey, cashlessAddress, name, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await issuePendingAliasTx(cashless, name);
}

exports.commitPendingAlias = async (providerURL, privateKey, cashlessAddress, name, attachAddress, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await commitPendingAliasTx(cashless, name, attachAddress);
}

exports.proposeSettlement = async (providerURL, privateKey, cashlessAddress, claimData, sig1, sig2, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await proposeSettlementTx(cashless, claimData, sig1, sig2);
}

exports.proposeLoop = async (providerURL, privateKey, cashlessAddress, loopName, addresses, minFlow, lockTime, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await proposeLoopTx(cashless, loopName, addresses, minFlow, lockTime);
}

exports.commitLoopClaim = async (providerURL, privateKey, cashlessAddress, loopID, encoded1, encoded2, contractPath) => {
	let provider = new ethers.providers.JsonRpcProvider(providerURL);
	let wallet = new ethers.Wallet(privateKey, provider);
	let cashless = getCashlessContract(provider, cashlessAddress, contractPath);
	cashless = cashless.connect(wallet);
	return await commitLoopClaimTx(cashless, loopID, encoded1, encoded2);
}