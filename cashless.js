const Web3 = require('web3');
const fs = require('fs');
const crypto = require('crypto');


const web3 = new Web3('http://127.0.0.1:7545');

var hashString = str => {
	const hash = crypto.createHash('sha256');
	hash.update(str);
	return hash.digest();
}

var rawABI = fs.readFileSync('bin/Cashless.abi');
var cashlessABI = JSON.parse(rawABI);

var deployCashless = sender => {
	let rawBIN = fs.readFileSync('bin/Cashless.bin');
	let cashlessBIN = JSON.parse(rawBIN)['object'];
	let myContract = new web3.eth.Contract(cashlessABI);
	let h = hashString('abc');
	return new Promise((resolve, reject) => {
		myContract.deploy({
		    data: cashlessBIN,
		    arguments: [h]
		})
		.send({
			from: sender,
		    gas: 6500000,
		    gasPrice: '30000000000'
		}, function(error, txHash){})
		.on('error', function(error) {
			reject(error);
		})
		.on('receipt', function(receipt) {
			console.log("deployed:", receipt.contractAddress);
			resolve(receipt.contractAddress);
		});
	});
}

var localFundedAddress = '0x73f4Bb88c7203A1937f4FFA739c7a042aA53BC16'; //FILL WITH ONE OF YOUR LOCAL DEFAULT ADDRESSES
deployCashless(localFundedAddress).then(function(addr) {
	var contract = new web3.eth.Contract(cashlessABI, addr);
	// verify communication with contract
	contract.methods.DOMAIN_SEPARATOR().call().then(function(resp) {
		console.log("contract global variable:", resp);
		console.log("PASS!");
	})
	.catch(function(error){
		console.log("error calling contract:", error.message);
	})
}).catch(function(error){
	console.log("error deploying:", error.message);
})