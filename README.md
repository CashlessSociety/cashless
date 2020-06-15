# Utunga Reserves


## Installation 

1. Install ganache here: https://www.trufflesuite.com/ganache

2. Clone this repo 
(First you must install git globally and be granted access to this repo)

```
git clone git@github.com:superarius/utunga-reserves.git
cd utunga-reserves
```

3. Make sure you have all the python3 dependencies. 
(First you must install python3 and virtualenv globally)

```
virtualenv env
. ./env/bin/activate
pip install -r requirements.txt
```

4. Start Ganache

If you installed it above just double click it or whatever. 

Choose quick start.

![quick start](./doc/ganache_quick_start.png)

5. Copy private keys from ganache into local_keys

Click on the 'key' for three random addresses and get the private key, copy it into the obvious place in local_keys.py

![private key](./doc/ganache_priv_keys.png)


6. Run tests (this will execute against local server)

```
python3 reserves_test.py
```

```
python3 cyclic_reciprocity_test.py
```
