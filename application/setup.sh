#!/bin/bash

curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/package.json -o package.json
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/importAdmin.js -o importAdmin.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/registerUser.js -o registerUser.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/install.js -o install.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/instantiate.js -o instantiate.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/invoke.js -o invoke.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/query.js -o query.js
curl https://raw.githubusercontent.com/ravastra/ARM-template-for-Hyperledger-Fabric-based-on-AKS/master/application/getConnector.sh -o getConnector.sh

chmod 777 getConnector.sh

echo "Loading all the required packages..."
npm install
