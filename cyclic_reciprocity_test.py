from web3 import Web3, HTTPProvider
from contract_controller import ReservesContractControl, CyclicReciprocityContractControl
from hashlib import sha256
import time, binascii, random
from local_keys import priv1, priv2, priv3
 
def random_hash():
	return sha256(''.join([random.choice('abcdefghijklmnopqrstuvwxyz1234567890') for _ in range(10)]).encode()).digest()

if __name__ == '__main__':

	# NOTE: MUST BE RUNNING LOCAL GANACHE SERVER
	w3 = Web3(HTTPProvider("http://localhost:7545"))

	reservesA = ReservesContractControl(priv1, w3)
	reservesA.deploy(random_hash(), 4000000)
	reservesB = ReservesContractControl(priv2, w3)
	reservesB.deploy(random_hash(), 4000000)
	reservesC = ReservesContractControl(priv3, w3)
	reservesC.deploy(random_hash(), 4000000)

	# A promises to B
	h1 = random_hash()
	ab1 = reservesA.encode_claim(h1, reservesB.contract.address, Web3.toWei(1, "ether"), 600, int(time.time()), int(time.time())+100000, 1)
	ab1_sig1 = reservesA.sign_claim(ab1)
	ab1_sig2 = reservesA.sign_claim(ab1, priv=priv2)

	# B promises to C
	h2 = random_hash()
	bc1 = reservesB.encode_claim(h2, reservesC.contract.address, Web3.toWei(0.6, "ether"), 600, int(time.time()), int(time.time())+100000, 1)
	bc1_sig1 = reservesB.sign_claim(bc1)
	bc1_sig2 = reservesB.sign_claim(bc1, priv=priv3)

	# C promises to A
	h3 = random_hash()
	ca1 = reservesC.encode_claim(h3, reservesA.contract.address, Web3.toWei(0.4, "ether"), 600, int(time.time()), int(time.time())+100000, 1)
	ca1_sig1 = reservesC.sign_claim(ca1)
	ca1_sig2 = reservesC.sign_claim(ca1, priv=priv1)

	# Propose cyclic reciprocity of min flow through A,B,C
	c = CyclicReciprocityContractControl(priv1, w3)
	c.deploy([reservesA.contract.address, reservesB.contract.address, reservesC.contract.address], Web3.toWei(0.4, "ether"), int(time.time())+100000, 4000000)

	# All parties sign adjusted claims (with debts cancelled out)
	ab2 = reservesA.encode_claim(h1, reservesB.contract.address, Web3.toWei(0.6, "ether"), 0, int(time.time()), int(time.time())+100000, 2, cyclicContract=c.contract.address)
	ab2_sig1 = reservesA.sign_claim(ab2)
	ab2_sig2 = reservesA.sign_claim(ab2, priv=priv2)

	bc2 = reservesB.encode_claim(h2, reservesC.contract.address, Web3.toWei(0.2, "ether"), 0, int(time.time()), int(time.time())+100000, 2, cyclicContract=c.contract.address)
	bc2_sig1 = reservesB.sign_claim(bc2)
	bc2_sig2 = reservesB.sign_claim(bc2, priv=priv3)

	ca2 = reservesC.encode_claim(h3, reservesA.contract.address, 0, 0, int(time.time()), int(time.time())+100000, 2, cyclicContract=c.contract.address)
	ca2_sig1 = reservesC.sign_claim(ca2)
	ca2_sig2 = reservesC.sign_claim(ca2, priv=priv1)

	# Claim information is submitted to Cyclic Reciprocity contract
	c.submit_claim(reservesA.contract.address, ab1, ab1_sig1, ab1_sig2, ab2, ab2_sig1, ab2_sig2, 4000000)
	c.submit_claim(reservesB.contract.address, bc1, bc1_sig1, bc1_sig2, bc2, bc2_sig1, bc2_sig2, 4000000)
	c.submit_claim(reservesC.contract.address, ca1, ca1_sig1, ca1_sig2, ca2, ca2_sig1, ca2_sig2, 4000000)

	# Settlement through cyclic reciprocity contract (only possible once all parties have submitted thte appropriate matching claims)
	reservesA.fund(Web3.toWei(1, "ether"), 1000000)
	c.settle_claim(reservesA.contract.address, 4000000)
	c.settle_claim(reservesB.contract.address, 4000000)

	if (Web3.toWei(0.4, "ether") != w3.eth.getBalance(reservesA.contract.address)) or (Web3.toWei(0.4, "ether") != w3.eth.getBalance(reservesB.contract.address)) or (Web3.toWei(0.2, "ether") != w3.eth.getBalance(reservesC.contract.address)):
		raise ValueError("FAILED TEST")
	print("PASS")


