# Build the consortium
To build the blockchain consortium post deploying the ordering service and peer nodes, you will have to carry out the below steps in sequence. Build Your Network script ([byn.sh](https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/blob/master/consortiumScripts/byn.sh)) will help you with setting up the consortium, creating channel and installing chaincode.

> **_Note:_** Build Your Network (byn.sh) script provided is strictly to be used for demo/devtest scenarios. For production grade setup we recommend using the native HLF APIs


All the commands to run the byn script can be executed through Azure Bash CLI. You can login into Azure shell web version through <img src="https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/blob/master/images/azureCLI_Icon.png" width="35" height="35" /> option at the top right corner of the Azure portal. Once the command prompt comes up, type bash and enter to switch to bash CLI.

See ([Azure Shell](https://docs.microsoft.com/en-us/azure/cloud-shell/overview)) for more information.
\
<img src="https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/blob/master/images/azureCLI.png" />


Download [byn.sh](https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/blob/master/consortiumScripts/byn.sh) and [fabric-admin.yaml](https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/blob/master/consortiumScripts/fabric-admin.yaml) file.

```bash
curl https://raw.githubusercontent.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/master/consortiumScripts/byn.sh -o byn.sh; chmod 777 byn.sh
curl https://raw.githubusercontent.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/master/consortiumScripts/fabric-admin.yaml -o fabric-admin.yaml
```

Set below environment variables on Azure CLI Bash shell:

set channel information and orderer organization information
```bash
SWITCH_TO_AKS_CLUSTER() { az aks get-credentials --resource-group $1 --name $2 --subscription $3; }
ORDERER_AKS_SUBSCRIPTION=<ordererAKSClusterSubscriptionID>
ORDERER_AKS_RESOURCE_GROUP=<ordererAKSClusterResourceGroup>
ORDERER_AKS_NAME=<ordererAKSClusterName>
ORDERER_DNS_ZONE=$(az aks show --resource-group $ORDERER_AKS_RESOURCE_GROUP --name $ORDERER_AKS_NAME --subscription $ORDERER_AKS_SUBSCRIPTION -o json | jq .addonProfiles.httpApplicationRouting.config.HTTPApplicationRoutingZoneName | tr -d '"')
ORDERER_END_POINT="orderer1.$ORDERER_DNS_ZONE:443"
CHANNEL_NAME=<channelName>
```
<a name="peer-aks"></a>
set peer organization information
```bash
PEER_AKS_RESOURCE_GROUP=<peerAKSClusterResourceGroup>
PEER_AKS_NAME=<peerAKSClusterName>
PEER_AKS_SUBSCRIPTION=<peerAKSClusterSubscriptionID>
# Peer organization name is case sensitive. Specify exactly the same name, which was provided while creating the Peer AKS Cluster.
PEER_ORG_NAME=<peerOrganizationName>
````

Create one Azure File share to share various public certificates among peer and orderer organizations.
```bash
STORAGE_SUBSCRIPTION=<subscriptionId>
STORAGE_RESOURCE_GROUP=<azureFileShareResourceGroup>
STORAGE_ACCOUNT=<azureStorageAccountName>
STORAGE_LOCATION=<azureStorageAccountLocation>
STORAGE_FILE_SHARE=<azureFileShareName>

az account set --subscription $STORAGE_SUBSCRIPTION
az group create -l $STORAGE_LOCATION -n $STORAGE_RESOURCE_GROUP
az storage account create -n $STORAGE_ACCOUNT -g  $STORAGE_RESOURCE_GROUP -l $STORAGE_LOCATION --sku Standard_LRS
STORAGE_KEY=$(az storage account keys list --resource-group $STORAGE_RESOURCE_GROUP  --account-name $STORAGE_ACCOUNT --query "[0].value" | tr -d '"')
az storage share create  --account-name $STORAGE_ACCOUNT  --account-key $STORAGE_KEY  --name $STORAGE_FILE_SHARE
SAS_TOKEN=$(az storage account generate-sas --account-key $STORAGE_KEY --account-name $STORAGE_ACCOUNT --expiry 2020-01-01 --https-only --permissions lruw --resource-types sco --services f | tr -d '"')
AZURE_FILE_CONNECTION_STRING="https://$STORAGE_ACCOUNT.file.core.windows.net/$STORAGE_FILE_SHARE?$SAS_TOKEN"
```

### 1. Channel Managment Commands
#### Create channel command
Go to orderer organization AKS cluster and issue command to create a new channel

```bash
SWITCH_TO_AKS_CLUSTER $ORDERER_AKS_RESOURCE_GROUP $ORDERER_AKS_NAME $ORDERER_AKS_SUBSCRIPTION
./byn.sh createChannel "$CHANNEL_NAME"
```

#### Setting anchor peer(s) command
Go to peer organization AKS cluster and issue below command to set anchor peer(s) for the peer organization on the specified channel.

> **_Note:_** Before executing this command, ensure that peer organization is added in the channel using Consortium management commands.

```bash
SWITCH_TO_AKS_CLUSTER $PEER_AKS_RESOURCE_GROUP $PEER_AKS_NAME $PEER_AKS_SUBSCRIPTION
./byn.sh updateAnchorPeer <anchorPeersList> "$CHANNEL_NAME" "$ORDERER_END_POINT" "$AZURE_FILE_CONNECTION_STRING"
```
```anchorPeersList``` is a comma separated list of peer nodes to be set as an anchor peer. For example,
- Set ```anchorPeersList``` as “peer1” if you want to set only peer1 node as anchor peer.
- Set ```anchorPeersList``` as “peer1,peer3” if you want to set both peer1 and peer3 node as anchor peer.


### 2. Consortium Managment Commands
Execute below commands in the given order to add a peer organization in a channel and consortium

Step 1:- Go to Peer Organization AKS Cluster and upload its Member Service Provider(MSP) on a Azure File Storage
```bash
SWITCH_TO_AKS_CLUSTER $PEER_AKS_RESOURCE_GROUP $PEER_AKS_NAME $PEER_AKS_SUBSCRIPTION
./byn.sh uploadOrgMSP "$AZURE_FILE_CONNECTION_STRING"
```
  
Step 2:- Go to orderer Organization AKS cluster and add the peer organization in channel and consortium
```bash
SWITCH_TO_AKS_CLUSTER $ORDERER_AKS_RESOURCE_GROUP $ORDERER_AKS_NAME $ORDERER_AKS_SUBSCRIPTION
# add peer in consortium
./byn.sh addPeerInConsortium "$PEER_ORG_NAME" "$AZURE_FILE_CONNECTION_STRING"
# add peer in channel
./byn.sh addPeerInChannel "$PEER_ORG_NAME" "$CHANNEL_NAME" "$AZURE_FILE_CONNECTION_STRING"
```

Step 3:- Go back to peer organization and issue command to join peer nodes in the channel
```bash
SWITCH_TO_AKS_CLUSTER $PEER_AKS_RESOURCE_GROUP $PEER_AKS_NAME $PEER_AKS_SUBSCRIPTION
./byn.sh joinNodesInChannel "$CHANNEL_NAME" "$ORDERER_END_POINT" "$AZURE_FILE_CONNECTION_STRING"
```
Similarly, to add more peer organization in the channel, update [peer AKS environment variables](#peer-aks) as per the required peer organization and executed step 1 to 3.

### 3. Chaincode managment commands
Execute the below commands to perform chaincode related operation. These commands perform all operation on a demo chaincode. This demo chaincode has two variable "a" and "b". On instantiation of the chaincode, "a" is initialized with 1000 and "b" is initialized with 2000. On each invocation of the chaincode, 10 units are tranferred from "a" to "b". Query operation on chaincode shows the world state of "a" variable.

These commands are to be executed on the peer organization AKS cluster.

```bash
# switch to peer organization AKS cluster. Skip this command if already connected to the required Peer AKS Cluster
SWITCH_TO_AKS_CLUSTER $PEER_AKS_RESOURCE_GROUP $PEER_AKS_NAME $PEER_AKS_SUBSCRIPTION
```

chaincode operation commands
```bash
PEER_NODE_NAME="peer<peer#>"
./byn.sh installDemoChaincode "$PEER_NODE_NAME"
./byn.sh instantiateDemoChaincode "$PEER_NODE_NAME" "$CHANNEL_NAME" "$ORDERER_END_POINT" "$AZURE_FILE_CONNECTION_STRING"
./byn.sh invokeDemoChaincode "$PEER_NODE_NAME" "$CHANNEL_NAME" "$ORDERER_END_POINT" "$AZURE_FILE_CONNECTION_STRING"
./byn.sh queryDemoChaincode "$PEER_NODE_NAME" "$CHANNEL_NAME"
```
Refer Run native HLF operations documentation [here](https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/tree/master/application/README.md) for running your own chaincode and creating new user identity.
