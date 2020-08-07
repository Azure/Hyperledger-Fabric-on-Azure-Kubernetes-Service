/*
 * FILE: invoke.js
 *
 * DESCRIPTION: Invoke chaincode
 *
 */

  'use strict';

  const { FileSystemWallet, Gateway } = require('fabric-network');
  const path = require('path');
  const fs = require('fs');
  const util = require('util');
  var args = require('yargs')
      .usage('Usage: <command> [options]')
      .command('invokeCC', 'Invoke chaincode transaction')
      .option({
      'o': {
      alias: 'orgName',
      describe: 'Name of organization',
      type: 'string',
      },
      'u': {
      alias: 'user',
      describe: 'User Identity',
      type: 'string',
      },
      'n': {
      alias: 'name',
      describe: 'Name of the chaincode',
      type: 'string',
      },
      'c': {
      alias: 'channel',
      describe: 'Channel where chaincode is to be invoked',
      type: 'string',
      },
      'f': {
      alias: 'func',
      describe: 'Function to be executed',
      type: 'string',
      },
      'a': {
      alias: 'args',
      describe: 'Comma separated list of arguments to the function',
      type: 'string',
      },
      })
      .help('h')
      .alias('h', 'help')
      .argv;

async function main() {
    try {
        var error_message = null;
        var orgName = args.orgName;
        var userId = args.user;
        var ccName = args.name;
        var ccFunc = args.func;
        var ccArgs = args.args;
        var channelName = args.channel;

        if ((orgName === undefined) ||
            (userId === undefined) ||
            (channelName === undefined) ||
            (ccName === undefined) ||
            (ccFunc === undefined) ||
            (ccArgs === undefined)) {
               console.error("Invalid arguments specified!!!!");
               console.error("Execute \'npm run invokeCC -- -h\' for help!!!!");
               process.exit(1);
        }
        ccArgs = ccArgs.split(",");

        var ccpFile = orgName + '-ccp.json';
        var ccpPath = path.resolve(__dirname, 'profile', ccpFile);
        var ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        var ccp = JSON.parse(ccpJSON);
        // Create a new file system based wallet for managing identities.
        var walletPath = path.join(process.cwd(), ccp.wallet);
        var wallet = new FileSystemWallet(walletPath);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(userId);
        if (!userExists) {
           console.log('Identity for \'' + userId + '\' user does not exist in the wallet');
           console.log('Register the user before retrying');
           return;
        }

        // Create a new gateway for connecting to our peer node.
        var gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: true, asLocalhost: false } });

        var client = gateway.getClient();

        // Set client TLS certificate and key for mutual TLS
        var userTlsCert = await wallet.export(userId+'-tls');
        client.setTlsClientCertAndKey(userTlsCert.certificate, userTlsCert.privateKey);

        var network = await gateway.getNetwork(channelName);
        var channel = network.getChannel();
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', channelName);
            console.log(message);
            throw new Error(message);
        }
        var orgMSPID = orgName;
        var peers = client.getPeersForOrg(orgMSPID);

        var tx_id = client.newTransactionID(true); // Get an admin based transactionID
        // An admin based transactionID will
        // indicate that admin identity should
        // be used to sign the proposal request.
        // will need the transaction ID string for the event registration later
        var deployId = tx_id.getTransactionID();

        // send proposal to endorser
        var request = {
         targets : peers,
         chaincodeId: ccName,
         fcn: ccFunc,
         args: ccArgs,
         chainId: channelName,
         txId: tx_id
        };
        let invokeResponse = await channel.sendTransactionProposal(request);
        
        // the returned object has both the endorsement results
        // and the actual proposal, the proposal will be needed
        // later when we send a transaction to the orederer
        var proposalResponses = invokeResponse[0];
        var proposal = invokeResponse[1];

        // lets have a look at the responses to see if they are
        // all good, if good they will also include signatures
        // required to be committed
        var all_good = true;
        for (var i in proposalResponses) {
            let one_good = false;
            if (proposalResponses && proposalResponses[i].response &&
                proposalResponses[i].response.status === 200) {
                one_good = true;
                console.log('invoke proposal was good');
            } else {
                console.log(`invoke proposal ${i} was bad ${proposalResponses}`);
            }
            all_good = all_good & one_good;
        }
        if (all_good) {
            let message = util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature);
            //console.log(`${message}`);

            // wait for the channel-based event hub to tell us
            // that the commit was good or bad on each peer in our organization
            var promises = [];
            let event_hubs = channel.getChannelEventHubsForOrg();
            event_hubs.forEach((eh) => {
                console.log('instantiateEventPromise - setting up event');
                let instantiateEventPromise = new Promise((resolve, reject) => {
                    let event_timeout = setTimeout(() => {
                        let message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
                        console.log(`${message}`);
                        eh.disconnect();
                    }, 10000);
                    eh.registerTxEvent(deployId, (tx, code, block_num) => {
                        let message = util.format('The invoke chaincode transaction has been committed on peer %s',eh.getPeerAddr());
                        console.log(`${message}`);
                        message = util.format('Transaction %s has status of %s in blocl %s', tx, code, block_num);
                        console.log(`${message}`);
                        clearTimeout(event_timeout);

                        if (code !== 'VALID') {
                            let message = util.format('The invoke chaincode transaction was invalid, code:%s',code);
                            console.log(`${message}`);
                            reject(new Error(message));
                        } else {
                            let message = 'The invoke chaincode transaction was valid.';
                            console.log(`${message}`);
                            resolve(message);
                        }
                    }, (err) => {
                        clearTimeout(event_timeout);
                        console.log(`${err}`);
                        reject(err);
                    },
                        // the default for 'unregister' is true for transaction listeners
                        // so no real need to set here, however for 'disconnect'
                        // the default is false as most event hubs are long running
                        // in this use case we are using it only once
                        {unregister: true, disconnect: true}
                    );
                    eh.connect();
                });
                promises.push(instantiateEventPromise);
            });


            var orderer_request = {
                txId: tx_id,
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            var sendPromise = channel.sendTransaction(orderer_request);
            // put the send to the orderer last so that the events get registered and
            // are ready for the orderering and committing
            promises.push(sendPromise);

            let results = await Promise.all(promises);
            console.log(util.format('------->>> R E S P O N S E : %j', results));
            let response = results.pop(); //  orderer results are last in the results

            if (response.status === 'SUCCESS') {
                console.log('Successfully sent transaction to the orderer.');
            } else {
                error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
                console.log(`${error_message}`);
            }

            // now see what each of the event hubs reported
            for(let i in results) {
                let event_hub_result = results[i];
                let event_hub = event_hubs[i];
                console.log('Event results for event hub: %s',event_hub.getPeerAddr());
                if(typeof event_hub_result === 'string') {
                    console.log(event_hub_result);
                } else {
                    if(!error_message) error_message = event_hub_result.toString();
                    console.log(event_hub_result.toString());
                }
            }

        } else {
            error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
            console.log(`${error_message}`);
        }
        } catch (error) {
            console.error(`Failed to invoke chaincode due to error:  ${error.stack} ? ${error.stack} : ${error}`);
            process.exit(1);
         }
}

main();
