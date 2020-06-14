# Utunga Reserves


## Installation 

1. Install ganache here: https://www.trufflesuite.com/ganache

2. Clone this repo 

```
git clone git@github.com:superarius/utunga-reserves.git
cd utunga-reserves
```

3. Make sure you have all the python3 dependencies: py_eth_sig_utils, eth_abi, web3 I think are the non standard ones you may not have

```
virtualenv env
. ./env/bin/activate
pip install -r requirements.txt
```

4. Start Ganache

If you installed it above just double click it or whatever. 

Choose quick start.

[!](./doc/ganache_quick_start.png)

5. Copy private keys from ganache into reserves_test

Click on the 'key' for three random addresses and get the private key, copy it into the obvious place in reserves_test.py

[!](./doc/ganache_priv_keys.png)


6. Run python test

```
python3 reserves_test.py
``
