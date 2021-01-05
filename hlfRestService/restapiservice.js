const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

var app = express();
app.use(bodyParser.json());

// Modules needed for Hyperledger Fabric
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');

const connectionProfile = fs.readFileSync(process.env.PEERORG_NAME + '_ConnectionProfile.json');
const connectionProfileJSON = JSON.parse(connectionProfile);

const adminCredentials = fs.readFileSync(process.env.PEERORG_NAME + '_AdminCredential.json');
const adminCredentialsJSON = JSON.parse(adminCredentials);

const channelName = process.env.CHANNEL_NAME;
const chaincodeName = process.env.CC_NAME;

app.post('/api/transfervalue/', async function (req, res) {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallets');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(adminCredentialsJSON.name);
        if (!userExists) {
            console.log(`An identity for the user: ${adminCredentialsJSON.name} does not exist in the wallet`);
            console.log(`Creating new file system wallet for the identity: ${adminCredentialsJSON.name} ...`);
            
            await importIdentityToWallet(adminCredentialsJSON);
        }

        // Create a new gateway for connecting to our peer node.

        const gateway = new Gateway();
        await gateway.connect(connectionProfileJSON, { 
            wallet, 
            identity: adminCredentialsJSON.name, 
            discovery: { enabled: true, asLocalhost: false } 
        });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channelName);

        // Get the contract from the network.
        const contract = network.getContract(chaincodeName);

        // Evaluate the specified transaction.
        await contract.submitTransaction('invoke', req.body.asset1, req.body.asset2, req.body.value);

        console.log('Transaction has been submitted');
        res.send('Transaction has been submitted');

        await gateway.disconnect();

    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
});

app.get('/api/query/:asset', async function (req, res) {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallets');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(adminCredentialsJSON.name);
        if (!userExists) {
            console.log(`An identity for the user: ${adminCredentialsJSON.name} does not exist in the wallet`);
            console.log(`Creating new file system wallet for the identity: ${adminCredentialsJSON.name} ...`);
            
            await importIdentityToWallet(adminCredentialsJSON);
        }

        // Create a new gateway for connecting to our peer node.

        const gateway = new Gateway();
        await gateway.connect(connectionProfileJSON, { 
            wallet, 
            identity: adminCredentialsJSON.name, 
            discovery: { enabled: true, asLocalhost: false } 
        });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channelName);

        // Get the contract from the network.
        const contract = network.getContract(chaincodeName);

        // Evaluate the specified transaction.
        const result = await contract.evaluateTransaction('query', req.params.asset);
        console.log(`Value of asset: ${req.params.asset} is: ${result.toString()}`);

        const responseString = "Value of asset: " + req.params.asset + " is: " + result.toString();
        res.status(200).json({response: responseString});

    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).json({error: error});
        process.exit(1);
    }
});

// Import identity to wallet
async function importIdentityToWallet(identityData) {
    const certBase64 = Buffer.from(identityData.cert, "base64");
    const keyBase64 = Buffer.from(identityData.private_key, "base64");

    const cert = certBase64.toString("ascii");
    const key = keyBase64.toString("ascii");

    const identity = X509WalletMixin.createIdentity(identityData.msp_id, cert, key);
    const userName = identityData.name;

    const walletPath = path.join(process.cwd(), 'wallets');
    const wallet = new FileSystemWallet(walletPath);
    await wallet.import(userName, identity);

    if (identityData.tls_cert && identityData.tls_private_key) {
        const tlsCertBase64 = Buffer.from(identityData.tls_cert, "base64");
        const tlsKeyBase64 = Buffer.from(identityData.tls_private_key, "base64");

        const tlsCert = tlsCertBase64.toString("ascii");
        const tlsKey =  tlsKeyBase64.toString("ascii");

        const tlsidentity = X509WalletMixin.createIdentity(identityData.msp_id, tlsCert, tlsKey);
        await wallet.import(userName + '-tls', tlsidentity);
    }
}

app.listen(7004);