const cashless = require('./../cashless.js');

(async () => {
	let args = process.argv;
	let providerURL = args[2];
	let privateKey = args[3];
    let amountToken = args[4];
    let wallet = cashless.wallet(providerURL, privateKey);
    let reserves = cashless.contract(providerURL, wallet);
    let usdc = cashless.stablecoinContract(providerURL, wallet);
	let res = await cashless.fundReservesTx(reserves, usdc, amountToken);
})();