from web3 import Web3, HTTPProvider
from contract_controller import ReservesContractControl, CyclicReciprocityContractControl
from hashlib import sha256
import time, binascii, random
from local_keys import priv3 as priv
 
def random_hash():
	return sha256(''.join([random.choice('abcdefghijklmnopqrstuvwxyz1234567890') for _ in range(10)]).encode()).digest()

if __name__ == '__main__':
	# NOTE: MUST BE RUNNING LOCAL GANACHE SERVER
	w3 = Web3(HTTPProvider("http://localhost:7545"))
	print("\n\n DEMO: NETWORK CREDIT (Carlos)")
	print("\n\ndeploying reserves contract...")
	reserves = ReservesContractControl(priv, w3)
	reserves.deploy(random_hash(), 4000000)
	print(f"reserves address: {reserves.contract.address}")
	sender, hexdata, sig1 = eval(input("\nreceive: "))
	data = binascii.unhexlify(hexdata)
	id_, r, values, nonce = reserves.decode_claim(data)
	print("\n")
	print(f"id: {id_},\nreceiver: {r},\namount: {values[0]/Web3.toWei(1, 'ether')},\ndispute_length: {values[1]},\nvest_time: {values[2]},\nvoid_time: {values[3]},\nnonce: {nonce}")
	v = input("\n accept and sign claim? ")
	sig2 = ReservesContractControl(priv, w3, contract_address=sender).sign_claim(data)
	fullClaim2 = [data, sig1, sig2]

	h1 = random_hash()
	receiver = input("\npromise for: ")
	amount = float(input("amount (in eth): "))
	input("vest date: ")
	data3 = reserves.encode_claim(h1, receiver, Web3.toWei(amount, "ether"), 600, int(time.time()), int(time.time())+100000, 1)
	data3_sig = reserves.sign_claim(data3)
	print("\n\nPROMISE:\n", [reserves.contract.address, binascii.hexlify(data3), data3_sig])

	cyclic, hexdata2, sig21 = eval(input("\nreceive: "))
	data2 = binascii.unhexlify(hexdata2)
	id_, r, values, nonce = reserves.decode_claim(data2)
	print("\n")
	print(f"id: {id_},\nreceiver: {r},\namount: {values[0]/Web3.toWei(1, 'ether')},\ndispute_length: {values[1]},\nvest_time: {values[2]},\nvoid_time: {values[3]},\nnonce: {nonce}")
	input("\naccept and sign? ")
	sig22 = ReservesContractControl(priv, w3, contract_address=sender).sign_claim(data2)
	c = CyclicReciprocityContractControl(priv, w3, contract_address=cyclic)
	c.submit_claim(sender, data, sig1, sig2, data2, sig21, sig22, 4000000)

	minFlow = c.contract.functions.minFlow().call()
	adjusted = reserves.encode_claim(h1, receiver,  Web3.toWei(amount, "ether")-minFlow, 0, int(time.time()), int(time.time())+100000, 2, cyclicContract=c.contract.address)
	adjusted_sig1 = reserves.sign_claim(adjusted)
	print("\n\nPROPOSAL:\n", [c.contract.address, binascii.hexlify(adjusted), adjusted_sig1])

	input("\nsettle? ")
	c.settle_claim(sender, 4000000)
	input("\nwithdraw? ")
	reserves.withdraw(w3.eth.getBalance(reserves.contract.address), 1000000)
