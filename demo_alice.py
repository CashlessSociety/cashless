from web3 import Web3, HTTPProvider
from contract_controller import ReservesContractControl, CyclicReciprocityContractControl
from hashlib import sha256
import time, binascii, random
from local_keys import priv1 as priv
 
def random_hash():
	return sha256(''.join([random.choice('abcdefghijklmnopqrstuvwxyz1234567890') for _ in range(10)]).encode()).digest()

if __name__ == '__main__':
	# NOTE: MUST BE RUNNING LOCAL GANACHE SERVER
	w3 = Web3(HTTPProvider("http://localhost:7545"))
	print("\n\n DEMO: NETWORK CREDIT (Alice)")
	print("\n\ndeploying reserves contract...")
	reserves = ReservesContractControl(priv, w3)
	reserves.deploy(random_hash(), 4000000)
	print(f"reserves address: {reserves.contract.address}")
	reserves.fund(Web3.toWei(float(input("\nfund your reserves (in eth): ")), "ether"), 1000000)
	h1 = random_hash()
	receiver = input("\npromise for: ")
	amount = float(input("amount (in eth): "))
	input("vest date: ")
	data1 = reserves.encode_claim(h1, receiver, Web3.toWei(amount, "ether"), 600, int(time.time()), int(time.time())+100000, 1)
	data1_sig = reserves.sign_claim(data1)
	print("\n\nPROMISE:\n")
	print([reserves.contract.address, binascii.hexlify(data1), data1_sig])

	sender, hexdata, sig1 = eval(input("\nreceive: "))
	data = binascii.unhexlify(hexdata)
	id_, r, values, nonce = reserves.decode_claim(data)
	print("\n")
	print(f"id: {id_},\nreceiver: {r},\namount: {values[0]/Web3.toWei(1, 'ether')},\ndispute_length: {values[1]},\nvest_time: {values[2]},\nvoid_time: {values[3]},\nnonce: {nonce}")
	input("\naccept and sign claim? ")
	sig2 = ReservesContractControl(priv, w3, contract_address=sender).sign_claim(data)
	fullClaim3 = [data, sig1, sig2]
	print("\n\n !! RECIPROCITY LOOP DETECTED !! \n")
	input("propose cyclic reciprocity? ")
	c = CyclicReciprocityContractControl(priv, w3)
	c.deploy([reserves.contract.address, receiver, sender], values[0], int(time.time())+100000, 4000000)
	ab2 = reserves.encode_claim(h1, receiver,  Web3.toWei(amount, "ether")-values[0], 0, int(time.time()), int(time.time())+100000, 2, cyclicContract=c.contract.address)
	ab2_sig1 = reserves.sign_claim(ab2)
	print("\n\nPROPOSAL:\n")
	print([c.contract.address, binascii.hexlify(ab2), ab2_sig1])

	_, hexdata2, sig21 = eval(input("receive: "))
	data2 = binascii.unhexlify(hexdata2)
	id_, r, values, nonce = reserves.decode_claim(data2)
	print("\n")
	print(f"id: {id_},\nreceiver: {r},\namount: {values[0]/Web3.toWei(1, 'ether')},\ndispute_length: {values[1]},\nvest_time: {values[2]},\nvoid_time: {values[3]},\nnonce: {nonce}")
	input("\naccept and sign? ")
	sig22 = ReservesContractControl(priv, w3, contract_address=sender).sign_claim(data2)
	c.submit_claim(sender, data, sig1, sig2, data2, sig21, sig22, 4000000)

	input("\nwithdraw? ")
	reserves.withdraw(w3.eth.getBalance(reserves.contract.address), 1000000)
